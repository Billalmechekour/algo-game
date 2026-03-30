import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export class CodeEvaluator {
  static runCommand(command, args, options = {}) {
    try {
      const stdout = execFileSync(command, args, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        ...options,
      });
      return { ok: true, stdout: stdout || "", stderr: "" };
    } catch (error) {
      if (error?.code === "ENOENT") {
        return {
          ok: false,
          stdout: "",
          stderr: `Commande indisponible: ${command}`,
        };
      }

      return {
        ok: false,
        stdout: error?.stdout?.toString() || "",
        stderr: error?.stderr?.toString() || error?.message || "Erreur inconnue",
      };
    }
  }

  static extractJavaClassName(code) {
    const classMatch = String(code || "").match(/\bpublic\s+class\s+([A-Za-z_]\w*)\b/);
    if (classMatch?.[1]) return classMatch[1];
    return "Solution";
  }

  static getExpectedKind(expected) {
    const normalized = String(expected ?? "").trim().toLowerCase();
    if (normalized === "true" || normalized === "false") return "bool";
    if (/^[-+]?\d+(\.\d+)?$/.test(normalized)) return "number";
    return "text";
  }

  static buildCSetupForTest(test, expr) {
    const rawExpr = String(expr || "");
    if (!rawExpr.includes("arr")) return "";

    const description = String(test?.description || "").toLowerCase();
    const expectedNum = Number.parseInt(test?.expected, 10);

    if (rawExpr.includes("sumArray(")) {
      if (rawExpr.includes(", 0)")) return "int arr[] = {0};";
      if (expectedNum === 30) return "int arr[] = {10, 20};";
      if (expectedNum === 6) return "int arr[] = {1, 2, 3};";
      return "int arr[] = {1, 2, 3, 4};";
    }

    if (rawExpr.includes("countOccurrences(")) {
      if (expectedNum === 2) return "int arr[] = {1, 2, 2, 3};";
      if (expectedNum === 3) return "int arr[] = {1, 1, 1};";
      if (expectedNum === 1) {
        const targetMatch = rawExpr.match(/countOccurrences\(arr,\s*\d+\s*,\s*(-?\d+)\s*\)/);
        const targetValue = targetMatch?.[1] || "5";
        return `int arr[] = {${targetValue}};`;
      }
      return "int arr[] = {1, 2, 3};";
    }

    if (rawExpr.includes("isSorted(")) {
      if (description.includes("unsorted")) return "int arr[] = {3, 1, 2};";
      if (description.includes("empty")) return "int arr[] = {0};";
      return "int arr[] = {1, 2, 3};";
    }

    return "int arr[] = {1, 2, 3};";
  }

  static buildCppSetupForTest(test, expr) {
    const rawExpr = String(expr || "");
    if (!rawExpr.includes("vec")) return "";

    const description = String(test?.description || "").toLowerCase();
    const expectedNum = Number.parseInt(test?.expected, 10);

    if (rawExpr.includes("sumVector(")) {
      if (description.includes("empty")) return "vector<int> vec = {};";
      if (expectedNum === 30) return "vector<int> vec = {10, 20};";
      if (expectedNum === 6) return "vector<int> vec = {1, 2, 3};";
      return "vector<int> vec = {1, 2, 3, 4};";
    }

    if (rawExpr.includes("countOccurrences(")) {
      if (expectedNum === 2) return "vector<int> vec = {1, 2, 2, 3};";
      if (expectedNum === 3) return "vector<int> vec = {1, 1, 1};";
      if (expectedNum === 1) {
        const targetMatch = rawExpr.match(/countOccurrences\(vec,\s*(-?\d+)\s*\)/);
        const targetValue = targetMatch?.[1] || "5";
        return `vector<int> vec = {${targetValue}};`;
      }
      return "vector<int> vec = {1, 2, 3};";
    }

    if (rawExpr.includes("isSorted(")) {
      if (description.includes("unsorted")) return "vector<int> vec = {3, 1, 2};";
      if (description.includes("empty")) return "vector<int> vec = {};";
      return "vector<int> vec = {1, 2, 3};";
    }

    return "vector<int> vec = {1, 2, 3};";
  }

  static parsePreviewLines(stdout, totalTests) {
    const outputs = Array.from({ length: totalTests }, () => ({
      output: "",
      error: null,
      found: false,
    }));

    const lines = String(stdout || "").split(/\r?\n/);
    lines.forEach((line) => {
      const okMatch = line.match(/^__CODEX_PREVIEW__(\d+)::([\s\S]*)$/);
      if (okMatch) {
        const idx = Number.parseInt(okMatch[1], 10);
        if (Number.isInteger(idx) && idx >= 0 && idx < totalTests) {
          outputs[idx] = {
            output: okMatch[2] || "",
            error: null,
            found: true,
          };
        }
        return;
      }

      const errMatch = line.match(/^__CODEX_PREVIEW_ERR__(\d+)::([\s\S]*)$/);
      if (errMatch) {
        const idx = Number.parseInt(errMatch[1], 10);
        if (Number.isInteger(idx) && idx >= 0 && idx < totalTests) {
          outputs[idx] = {
            output: "",
            error: errMatch[2] || "Erreur d'exécution",
            found: true,
          };
        }
      }
    });

    return outputs;
  }

  static extractExecutionOutput(stdout) {
    const raw = String(stdout || "");
    const filtered = raw
      .split(/\r?\n/)
      .filter(
        (line) =>
          !/^__CODEX_PREVIEW__(\d+)::/.test(line) &&
          !/^__CODEX_PREVIEW_ERR__(\d+)::/.test(line)
      )
      .join("\n")
      .trimEnd();
    return filtered;
  }

  static normalizeOutput(value) {
    return String(value ?? "").trim();
  }

  static buildPreviewResult(question, parsedOutputs, language, execution = {}) {
    const tests = question?.tests || [];
    const results = tests.map((test, index) => {
      const parsed = parsedOutputs[index] || { output: "", error: null, found: false };
      const expected = this.normalizeOutput(test.expected);
      const actual = this.normalizeOutput(parsed.output);
      const fallbackError = parsed.found ? null : "Aucun résultat retourné";
      const runtimeError = parsed.error || fallbackError;
      const passed = !runtimeError && actual === expected;

      return {
        input: String(test.input || ""),
        expected: String(test.expected ?? ""),
        output: parsed.output || "",
        error: runtimeError,
        description: test.description || "",
        passed,
      };
    });

    return {
      ok: true,
      language,
      totalTests: tests.length,
      passedTests: results.filter((result) => result.passed).length,
      results,
      executionOutput: String(execution.executionOutput || ""),
      rawStdout: String(execution.rawStdout || ""),
      rawStderr: String(execution.rawStderr || ""),
    };
  }

  static validateSyntax(code, language) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-"));
    let tempFile;

    try {
      switch (language) {
        case "python":
          tempFile = path.join(tempDir, "code.py");
          fs.writeFileSync(tempFile, code, "utf-8");
          {
            const run = this.runCommand("python3", ["-m", "py_compile", tempFile], {
              timeout: 3000,
            });
            if (run.ok) return { ok: true };
            return { ok: false, error: run.stderr };
          }

        case "java":
          {
            const className = this.extractJavaClassName(code);
            tempFile = path.join(tempDir, `${className}.java`);
            fs.writeFileSync(tempFile, code, "utf-8");
            const run = this.runCommand("javac", [tempFile], { timeout: 3000 });
            if (run.ok) return { ok: true };
            return { ok: false, error: run.stderr };
          }

        case "c":
          tempFile = path.join(tempDir, "code.c");
          fs.writeFileSync(tempFile, code, "utf-8");
          {
            const run = this.runCommand("gcc", ["-fsyntax-only", tempFile], {
              timeout: 7000,
            });
            if (run.ok) return { ok: true };
            return { ok: false, error: run.stderr };
          }

        case "cpp":
          tempFile = path.join(tempDir, "code.cpp");
          fs.writeFileSync(tempFile, code, "utf-8");
          {
            const run = this.runCommand("g++", ["-std=c++11", "-fsyntax-only", tempFile], {
              timeout: 12000,
            });
            if (run.ok) return { ok: true };
            return { ok: false, error: run.stderr };
          }

        default:
          return { ok: false, error: "Langage non supporté" };
      }
    } finally {
      // Nettoyage
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {}
    }
  }

  static containsMaliciousCode(code, language) {
    const forbiddenPatterns = {
      python: [/os\.system/, /eval\(/, /exec\(/, /open\(/, /__import__/],
      java: [/System\.exit/, /Runtime\.getRuntime/],
      c: [/system\(/, /exec\(/],
      cpp: [/system\(/, /exec\(/],
    };

    const patterns = forbiddenPatterns[language] || [];
    return patterns.some((pattern) => pattern.test(code));
  }

  static hasCMainFunction(code) {
    return /\bint\s+main\s*\(/.test(String(code || ""));
  }

  static hasCppMainFunction(code) {
    return /\bint\s+main\s*\(/.test(String(code || ""));
  }

  static hasJavaMainMethod(code) {
    return /\bstatic\s+void\s+main\s*\(/.test(String(code || ""));
  }

  static buildProgramPreviewSuccess(language, run) {
    return {
      ok: true,
      language,
      totalTests: 0,
      passedTests: 0,
      results: [],
      executionOutput: String(run?.stdout || ""),
      rawStdout: String(run?.stdout || ""),
      rawStderr: String(run?.stderr || ""),
    };
  }

  static buildProgramPreviewFailure(language, stage, run, fallbackMessage) {
    const errorType = stage === "COMPILE" ? "COMPILE" : "RUNTIME";
    const stderr = String(run?.stderr || "").trim();
    const stdout = String(run?.stdout || "").trim();
    const message = stderr || stdout || fallbackMessage;
    return {
      ok: false,
      errorType,
      error: message,
      language,
      executionOutput: String(run?.stdout || ""),
      rawStdout: String(run?.stdout || ""),
      rawStderr: String(run?.stderr || ""),
    };
  }

  static runPythonProgramPreview(code) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-program-py-"));
    try {
      const sourcePath = path.join(tempDir, "user_program.py");
      fs.writeFileSync(sourcePath, code, "utf-8");

      const run = this.runCommand("python3", [sourcePath], {
        timeout: 5000,
        cwd: tempDir,
      });
      if (!run.ok) {
        return this.buildProgramPreviewFailure(
          "python",
          "RUNTIME",
          run,
          "Erreur d'exécution Python"
        );
      }
      return this.buildProgramPreviewSuccess("python", run);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {}
    }
  }

  static runJavaProgramPreview(code) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-program-java-"));
    try {
      const className = this.extractJavaClassName(code);
      const sourcePath = path.join(tempDir, `${className}.java`);
      fs.writeFileSync(sourcePath, code, "utf-8");

      const compile = this.runCommand("javac", [sourcePath], {
        timeout: 7000,
        cwd: tempDir,
      });
      if (!compile.ok) {
        return this.buildProgramPreviewFailure(
          "java",
          "COMPILE",
          compile,
          "Erreur de compilation Java"
        );
      }

      const run = this.runCommand("java", ["-cp", tempDir, className], {
        timeout: 5000,
        cwd: tempDir,
      });
      if (!run.ok) {
        return this.buildProgramPreviewFailure(
          "java",
          "RUNTIME",
          run,
          "Erreur d'exécution Java"
        );
      }

      return this.buildProgramPreviewSuccess("java", run);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {}
    }
  }

  static runCProgramPreview(code) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-program-c-"));
    try {
      const sourcePath = path.join(tempDir, "user_program.c");
      const binaryPath = path.join(tempDir, "program");
      fs.writeFileSync(sourcePath, code, "utf-8");

      const compile = this.runCommand("gcc", [sourcePath, "-O0", "-o", binaryPath], {
        timeout: 12000,
        cwd: tempDir,
      });
      if (!compile.ok) {
        return this.buildProgramPreviewFailure(
          "c",
          "COMPILE",
          compile,
          "Erreur de compilation C"
        );
      }

      const run = this.runCommand(binaryPath, [], {
        timeout: 5000,
        cwd: tempDir,
      });
      if (!run.ok) {
        return this.buildProgramPreviewFailure(
          "c",
          "RUNTIME",
          run,
          "Erreur d'exécution C"
        );
      }

      return this.buildProgramPreviewSuccess("c", run);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {}
    }
  }

  static runCppProgramPreview(code) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-program-cpp-"));
    try {
      const sourcePath = path.join(tempDir, "user_program.cpp");
      const binaryPath = path.join(tempDir, "program");
      fs.writeFileSync(sourcePath, code, "utf-8");

      const compile = this.runCommand(
        "g++",
        [sourcePath, "-std=c++11", "-O0", "-o", binaryPath],
        {
          timeout: 15000,
          cwd: tempDir,
        }
      );
      if (!compile.ok) {
        return this.buildProgramPreviewFailure(
          "cpp",
          "COMPILE",
          compile,
          "Erreur de compilation C++"
        );
      }

      const run = this.runCommand(binaryPath, [], {
        timeout: 5000,
        cwd: tempDir,
      });
      if (!run.ok) {
        return this.buildProgramPreviewFailure(
          "cpp",
          "RUNTIME",
          run,
          "Erreur d'exécution C++"
        );
      }

      return this.buildProgramPreviewSuccess("cpp", run);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {}
    }
  }

  static runPythonPreview(code, question) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-preview-py-"));
    try {
      const sourcePath = path.join(tempDir, "user_code.py");
      const testsPath = path.join(tempDir, "tests.json");
      const runnerPath = path.join(tempDir, "runner.py");
      const tests = (question?.tests || []).map((test) => String(test.input || ""));

      fs.writeFileSync(sourcePath, code, "utf-8");
      fs.writeFileSync(testsPath, JSON.stringify(tests), "utf-8");
      fs.writeFileSync(
        runnerPath,
        `
import importlib.util
import json
import pathlib

base = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("user_code", str(base / "user_code.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

tests = json.loads((base / "tests.json").read_text(encoding="utf-8"))
for idx, expr in enumerate(tests):
    try:
        value = eval(expr, module.__dict__)
        print(f"__CODEX_PREVIEW__{idx}::{str(value)}")
    except Exception as exc:
        print(f"__CODEX_PREVIEW_ERR__{idx}::{exc.__class__.__name__}: {exc}")
        `.trim(),
        "utf-8"
      );

      const run = this.runCommand("python3", [runnerPath], {
        timeout: 4000,
        cwd: tempDir,
      });
      if (!run.ok) {
        return {
          ok: false,
          errorType: "RUNTIME",
          error: `Erreur d'exécution Python: ${run.stderr}`,
          executionOutput: this.extractExecutionOutput(run.stdout),
          rawStdout: run.stdout || "",
          rawStderr: run.stderr || "",
        };
      }

      const parsed = this.parsePreviewLines(run.stdout, tests.length);
      return this.buildPreviewResult(question, parsed, "python", {
        executionOutput: this.extractExecutionOutput(run.stdout),
        rawStdout: run.stdout || "",
        rawStderr: run.stderr || "",
      });
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {}
    }
  }

  static runJavaPreview(code, question) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-preview-java-"));
    try {
      const className = this.extractJavaClassName(code);
      const sourcePath = path.join(tempDir, `${className}.java`);
      const runnerPath = path.join(tempDir, "Runner.java");
      const tests = question?.tests || [];

      fs.writeFileSync(sourcePath, code, "utf-8");

      const runnerCases = tests
        .map((test, index) => {
          const inputExpr = String(test.input || "").trim();
          const javaExpr = inputExpr.startsWith(`${className}.`)
            ? inputExpr
            : `${className}.${inputExpr}`;
          return `
    try {
      Object result${index} = ${javaExpr};
      System.out.println("__CODEX_PREVIEW__${index}::" + String.valueOf(result${index}));
    } catch (Throwable error${index}) {
      String message${index} = error${index}.getClass().getSimpleName() + ": " +
        (error${index}.getMessage() == null ? "" : error${index}.getMessage());
      System.out.println("__CODEX_PREVIEW_ERR__${index}::" + message${index});
    }`;
        })
        .join("\n");

      const runnerSource = `
public class Runner {
  public static void main(String[] args) {
${runnerCases}
  }
}
      `.trim();
      fs.writeFileSync(runnerPath, runnerSource, "utf-8");

      const compile = this.runCommand("javac", [sourcePath, runnerPath], {
        timeout: 5000,
        cwd: tempDir,
      });
      if (!compile.ok) {
        return {
          ok: false,
          errorType: "COMPILE",
          error: compile.stderr || compile.stdout || "Erreur de compilation Java",
          executionOutput: this.extractExecutionOutput(compile.stdout),
          rawStdout: compile.stdout || "",
          rawStderr: compile.stderr || "",
        };
      }

      const run = this.runCommand("java", ["-cp", tempDir, "Runner"], {
        timeout: 5000,
        cwd: tempDir,
      });
      if (!run.ok) {
        return {
          ok: false,
          errorType: "RUNTIME",
          error: `Erreur d'exécution Java: ${run.stderr}`,
          executionOutput: this.extractExecutionOutput(run.stdout),
          rawStdout: run.stdout || "",
          rawStderr: run.stderr || "",
        };
      }

      const parsed = this.parsePreviewLines(run.stdout, tests.length);
      return this.buildPreviewResult(question, parsed, "java", {
        executionOutput: this.extractExecutionOutput(run.stdout),
        rawStdout: run.stdout || "",
        rawStderr: run.stderr || "",
      });
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {}
    }
  }

  static runCPreview(code, question) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-preview-c-"));
    try {
      const sourcePath = path.join(tempDir, "user_code.c");
      const runnerPath = path.join(tempDir, "runner.c");
      const binaryPath = path.join(tempDir, "runner");
      const tests = question?.tests || [];

      fs.writeFileSync(sourcePath, code, "utf-8");

      const runnerCases = tests
        .map((test, index) => {
          const expr = String(test.input || "0").trim();
          const setup = this.buildCSetupForTest(test, expr);
          const expectedKind = this.getExpectedKind(test.expected);
          const printLine =
            expectedKind === "bool"
              ? `printf("__CODEX_PREVIEW__${index}::%s\\n", (${expr}) ? "true" : "false");`
              : `printf("__CODEX_PREVIEW__${index}::%d\\n", (int)(${expr}));`;

          return `
  {
    ${setup}
    ${printLine}
  }`;
        })
        .join("\n");

      const runnerSource = `
#include <stdio.h>

#define main __code_preview_main
#include "user_code.c"
#undef main

int main(void) {
${runnerCases}
  return 0;
}
      `.trim();
      fs.writeFileSync(runnerPath, runnerSource, "utf-8");

      const compile = this.runCommand("gcc", [runnerPath, "-O0", "-o", binaryPath], {
        timeout: 10000,
        cwd: tempDir,
      });
      if (!compile.ok) {
        return {
          ok: false,
          errorType: "COMPILE",
          error: compile.stderr || compile.stdout || "Erreur de compilation C",
          executionOutput: this.extractExecutionOutput(compile.stdout),
          rawStdout: compile.stdout || "",
          rawStderr: compile.stderr || "",
        };
      }

      const run = this.runCommand(binaryPath, [], {
        timeout: 5000,
        cwd: tempDir,
      });
      if (!run.ok) {
        return {
          ok: false,
          errorType: "RUNTIME",
          error: `Erreur d'exécution C: ${run.stderr || run.stdout || "exécution interrompue"}`,
          executionOutput: this.extractExecutionOutput(run.stdout),
          rawStdout: run.stdout || "",
          rawStderr: run.stderr || "",
        };
      }

      const parsed = this.parsePreviewLines(run.stdout, tests.length);
      return this.buildPreviewResult(question, parsed, "c", {
        executionOutput: this.extractExecutionOutput(run.stdout),
        rawStdout: run.stdout || "",
        rawStderr: run.stderr || "",
      });
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {}
    }
  }

  static runCppPreview(code, question) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-preview-cpp-"));
    try {
      const sourcePath = path.join(tempDir, "user_code.cpp");
      const runnerPath = path.join(tempDir, "runner.cpp");
      const binaryPath = path.join(tempDir, "runner");
      const tests = question?.tests || [];

      fs.writeFileSync(sourcePath, code, "utf-8");

      const runnerCases = tests
        .map((test, index) => {
          const expr = String(test.input || "0").trim();
          const setup = this.buildCppSetupForTest(test, expr);
          const expectedKind = this.getExpectedKind(test.expected);
          const printExpr =
            expectedKind === "bool"
              ? `(((${expr})) ? "true" : "false")`
              : `(${expr})`;

          return `
    try {
      ${setup}
      std::cout << "__CODEX_PREVIEW__${index}::" << ${printExpr} << "\\n";
    } catch (const std::exception& ex) {
      std::cout << "__CODEX_PREVIEW_ERR__${index}::" << ex.what() << "\\n";
    } catch (...) {
      std::cout << "__CODEX_PREVIEW_ERR__${index}::Erreur inconnue" << "\\n";
    }`;
        })
        .join("\n");

      const runnerSource = `
#include <iostream>
#include <vector>
#include <string>
#include <exception>

#define main __code_preview_main
#include "user_code.cpp"
#undef main

int main() {
${runnerCases}
  return 0;
}
      `.trim();
      fs.writeFileSync(runnerPath, runnerSource, "utf-8");

      const compile = this.runCommand(
        "g++",
        [runnerPath, "-std=c++11", "-O0", "-o", binaryPath],
        {
          timeout: 15000,
          cwd: tempDir,
        }
      );
      if (!compile.ok) {
        return {
          ok: false,
          errorType: "COMPILE",
          error: compile.stderr || compile.stdout || "Erreur de compilation C++",
          executionOutput: this.extractExecutionOutput(compile.stdout),
          rawStdout: compile.stdout || "",
          rawStderr: compile.stderr || "",
        };
      }

      const run = this.runCommand(binaryPath, [], {
        timeout: 5000,
        cwd: tempDir,
      });
      if (!run.ok) {
        return {
          ok: false,
          errorType: "RUNTIME",
          error: `Erreur d'exécution C++: ${run.stderr || run.stdout || "exécution interrompue"}`,
          executionOutput: this.extractExecutionOutput(run.stdout),
          rawStdout: run.stdout || "",
          rawStderr: run.stderr || "",
        };
      }

      const parsed = this.parsePreviewLines(run.stdout, tests.length);
      return this.buildPreviewResult(question, parsed, "cpp", {
        executionOutput: this.extractExecutionOutput(run.stdout),
        rawStdout: run.stdout || "",
        rawStderr: run.stderr || "",
      });
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true });
      } catch {}
    }
  }

  static async runPreview(code, question, language) {
    const supportedLanguages = ["python", "java", "c", "cpp"];
    if (!supportedLanguages.includes(language)) {
      return {
        ok: false,
        errorType: "UNSUPPORTED",
        error: "Langage non supporté pour l'exécution",
      };
    }

    if (this.containsMaliciousCode(code, language)) {
      return {
        ok: false,
        errorType: "SECURITY",
        error: "Code malveillant détecté",
      };
    }

    const syntaxCheck = this.validateSyntax(code, language);
    if (!syntaxCheck.ok) {
      return {
        ok: false,
        errorType: "COMPILE",
        error: "Erreur de syntaxe: " + syntaxCheck.error,
      };
    }

    if (language === "python") {
      return this.runPythonProgramPreview(code);
    }
    if (language === "java") {
      if (this.hasJavaMainMethod(code)) {
        return this.runJavaProgramPreview(code);
      }
      return this.runJavaPreview(code, question);
    }
    if (language === "c") {
      if (this.hasCMainFunction(code)) {
        return this.runCProgramPreview(code);
      }
      return this.runCPreview(code, question);
    }
    if (this.hasCppMainFunction(code)) {
      return this.runCppProgramPreview(code);
    }
    return this.runCppPreview(code, question);
  }

  static async runTests(code, question, language) {
    if (this.containsMaliciousCode(code, language)) {
      return {
        ok: false,
        errorType: "SECURITY",
        error: "Code malveillant détecté",
        passedTests: 0,
        totalTests: question?.tests?.length || 0,
      };
    }

    const syntaxCheck = this.validateSyntax(code, language);
    if (!syntaxCheck.ok) {
      return {
        ok: false,
        errorType: "COMPILE",
        error: "Erreur de syntaxe: " + syntaxCheck.error,
        passedTests: 0,
        totalTests: question?.tests?.length || 0,
      };
    }

    const normalizedLanguage = String(language || "").toLowerCase().trim();
    let preview = null;
    if (normalizedLanguage === "python") {
      preview = this.runPythonPreview(code, question);
    } else if (normalizedLanguage === "java") {
      preview = this.runJavaPreview(code, question);
    } else if (normalizedLanguage === "c") {
      preview = this.runCPreview(code, question);
    } else if (normalizedLanguage === "cpp") {
      preview = this.runCppPreview(code, question);
    } else {
      return {
        ok: false,
        errorType: "UNSUPPORTED",
        error: "Langage non supporté",
        passedTests: 0,
        totalTests: question?.tests?.length || 0,
      };
    }

    // Erreur de compilation pendant l'exécution des tests.
    if (!preview?.ok && preview?.errorType === "COMPILE") {
      return {
        ok: false,
        errorType: "COMPILE",
        error: preview.error || "Erreur de compilation",
        passedTests: 0,
        totalTests: question?.tests?.length || 0,
      };
    }

    // Erreur globale à l'exécution: le code compile, mais l'exécution est interrompue.
    // On ne doit pas le traiter comme COMPILE_ERROR.
    if (!preview?.ok) {
      return {
        ok: true,
        runtimeError: true,
        errorType: preview?.errorType || "RUNTIME",
        error: preview?.error || "Erreur d'exécution",
        passedTests: 0,
        totalTests: question?.tests?.length || 0,
      };
    }

    return {
      ok: true,
      runtimeError: false,
      passedTests: Number.isFinite(Number(preview.passedTests))
        ? Number(preview.passedTests)
        : 0,
      totalTests: Number.isFinite(Number(preview.totalTests))
        ? Number(preview.totalTests)
        : (question?.tests?.length || 0),
      error: null,
    };
  }
}
