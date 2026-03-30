export const QUESTION_BANK = {
  FLASH: {
    SIMPLE: [
      {
        id: "js_2_plus_2_string",
        type: "FLASH",
        prompt: "Quel est le résultat de 2 + '2' en JavaScript ?",
        choices: ["4", "22", "NaN", "erreur"],
        correct: "22",
      },
      {
        id: "js_return_hello",
        type: "FLASH",
        prompt: "Que retourne cette fonction ?\n\nfunction f(){ return 'bonjour'; }\nconsole.log(f());",
        choices: ["bonjour", "undefined", "null", "erreur"],
        correct: "bonjour",
      },
    ],
    MEDIUM: [
      {
        id: "py_list_append",
        type: "FLASH",
        prompt: "En Python, que fait list.append(x) ?",
        choices: ["Ajoute à la fin", "Ajoute au début", "Supprime x", "Trie la liste"],
        correct: "Ajoute à la fin",
      },
    ],
    HARD: [
      {
        id: "js_closure",
        type: "FLASH",
        prompt: "En JS, une closure c’est quoi ?",
        choices: ["Une variable globale", "Une fonction + scope capturé", "Un if", "Une boucle"],
        correct: "Une fonction + scope capturé",
      },
    ],
  },
};

// Utilitaire: tire n questions au hasard.
export function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}
