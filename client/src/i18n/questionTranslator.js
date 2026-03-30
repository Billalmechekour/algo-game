function applyReplacements(value, replacements) {
  let output = String(value || "");
  replacements.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}

const exactChoiceMap = new Map([
  ["Rien", "Nothing"],
  ["Une fonction", "A function"],
  ["Un commentaire", "A comment"],
  ["Une boucle conditionnelle", "A conditional loop"],
  ["Une boucle d'itération", "An iteration loop"],
  ["Une boucle d'iteration", "An iteration loop"],
  ["Une variable", "A variable"],
  ["Une adresse mémoire", "A memory address"],
  ["Une adresse memoire", "A memory address"],
  ["Une abstraction", "An abstraction"],
  ["Une interface", "An interface"],
  ["Une classe abstraite", "An abstract class"],
  ["Plusieurs formes", "Multiple forms"],
]);

const genericReplacements = [
  [/Écrivez une fonction qui/gi, "Write a function that"],
  [/Ecrivez une fonction qui/gi, "Write a function that"],
  [/La fonction doit s'appeler/gi, "The function must be named"],
  [/la fonction doit s'appeler/gi, "the function must be named"],
  [/Qu'affiche le code suivant\?/gi, "What does the following code print?"],
  [/Quel est le résultat de\s*:/gi, "What is the result of:"],
  [/Quel est le resultat de\s*:/gi, "What is the result of:"],
  [/Quelle est la bonne syntaxe pour créer une liste en Python\?/gi, "What is the correct syntax to create a list in Python?"],
  [/Quelle est la bonne syntaxe pour creer une liste en Python\?/gi, "What is the correct syntax to create a list in Python?"],
  [/Qu'est-ce que/gi, "What is"],
  [/qu'est-ce que/gi, "what is"],
  [/Quel est/gi, "What is"],
  [/Quel operateur/gi, "Which operator"],
  [/Quel mot-cle/gi, "Which keyword"],
  [/Quelle est/gi, "What is"],
  [/dans quels cas/gi, "in which cases"],
  [/quel algorithme/gi, "which algorithm"],
  [/quelle stratégie/gi, "which strategy"],
  [/quelle strategie/gi, "which strategy"],
  [/quels cas/gi, "which cases"],
  [/retourne/gi, "returns"],
  [/vérifie si/gi, "checks whether"],
  [/verifie si/gi, "checks whether"],
  [/calcule/gi, "computes"],
  [/compte/gi, "counts"],
  [/nombre d'occurrences/gi, "number of occurrences"],
  [/nombre de bits a 1/gi, "number of set bits"],
  [/plus court chemin/gi, "shortest path"],
  [/poids non negatifs/gi, "non-negative weights"],
  [/poids négatifs/gi, "negative weights"],
  [/poids negatifs/gi, "negative weights"],
  [/sans cycle negatif/gi, "without a negative cycle"],
  [/programmation dynamique/gi, "dynamic programming"],
  [/sous-problemes qui se repetent/gi, "repeating subproblems"],
  [/recursion trop profonde/gi, "recursion that is too deep"],
  [/depassement de pile/gi, "stack overflow"],
  [/complexite/gi, "complexity"],
  [/memoization/gi, "memoization"],
  [/overflow entier/gi, "integer overflow"],
  [/race condition/gi, "race condition"],
  [/executions concurrentes/gi, "concurrent executions"],
  [/meme donnee/gi, "same data"],
  [/graphe non pondere/gi, "unweighted graph"],
  [/graphe dense/gi, "dense graph"],
  [/nombre d'aretes/gi, "number of edges"],
  [/iterer/gi, "iterate"],
  [/incremente/gi, "increments"],
  [/decremente/gi, "decrements"],
  [/multiplie par/gi, "multiplied by"],
  [/diminue de/gi, "decreased by"],
  [/augmente de/gi, "increased by"],
  [/en valeur absolue/gi, "in absolute value"],
  [/valeur absolue/gi, "absolute value"],
  [/entiers positifs/gi, "positive integers"],
  [/entier positif/gi, "positive integer"],
  [/entiers/gi, "integers"],
  [/entier/gi, "integer"],
  [/premier terme/gi, "first term"],
  [/raison d/gi, "common difference d"],
  [/suite arithmetique/gi, "arithmetic sequence"],
  [/n-ieme/gi, "n-th"],
  [/strictement superieur/gi, "strictly greater"],
  [/superieur ou egal/gi, "greater than or equal"],
  [/superieur/gi, "greater"],
  [/carre parfait/gi, "perfect square"],
  [/carres/gi, "squares"],
  [/carre/gi, "square"],
  [/somme des chiffres/gi, "sum of digits"],
  [/somme des entiers/gi, "sum of integers"],
  [/somme de deux nombres/gi, "sum of two numbers"],
  [/somme de deux entiers/gi, "sum of two integers"],
  [/somme de trois entiers/gi, "sum of three integers"],
  [/somme des n premiers termes/gi, "sum of the first n terms"],
  [/somme des multiples/gi, "sum of multiples"],
  [/somme des entiers impairs/gi, "sum of odd integers"],
  [/somme des chiffres pairs/gi, "sum of even digits"],
  [/retourne 1 si/gi, "returns 1 if"],
  [/sinon 0/gi, "otherwise 0"],
  [/sinon 1/gi, "otherwise 1"],
  [/sinon False/gi, "otherwise False"],
  [/sinon True/gi, "otherwise True"],
  [/si n est premier/gi, "if n is prime"],
  [/si un entier positif est palindrome/gi, "if a positive integer is a palindrome"],
  [/si n est pair/gi, "if n is even"],
  [/si n vaut 0/gi, "if n equals 0"],
  [/si n est une puissance de 2/gi, "if n is a power of 2"],
  [/si n est un carre parfait/gi, "if n is a perfect square"],
  [/si a et b sont premiers entre eux/gi, "if a and b are coprime"],
  [/si x est dans l'intervalle \[a, b\]/gi, "if x is in the interval [a, b]"],
  [/si a est multiple de b/gi, "if a is a multiple of b"],
  [/Quel est l'objectif principal de/gi, "What is the main goal of"],
  [/Une classe abstraite/gi, "An abstract class"],
  [/Une abstraction/gi, "An abstraction"],
  [/Une interface/gi, "An interface"],
  [/Une constante/gi, "A constant"],
  [/Un module/gi, "A module"],
  [/Une fonction anonyme/gi, "An anonymous function"],
  [/Créer une instance/gi, "Create an instance"],
  [/Modifier un objet/gi, "Modify an object"],
  [/Copier du code/gi, "Copy code"],
  [/Aucune boucle/gi, "No loop"],
  [/Aucun des deux/gi, "None of the two"],
  [/Les deux utilisent toujours la meme memoire/gi, "Both always use the same memory"],
  [/Compilation plus rapide/gi, "Faster compilation"],
  [/Erreur reseau/gi, "Network error"],
  [/Suppression automatique de la variable/gi, "Automatic variable deletion"],
  [/Depassement de la plage representable/gi, "Exceeding the representable range"],
  [/Eviter de recalculer des resultats deja obtenus/gi, "Avoid recomputing already obtained results"],
  [/Eviter les fonctions/gi, "Avoid functions"],
  [/Remplacer les boucles/gi, "Replace loops"],
  [/Compresser les fichiers/gi, "Compress files"],
  [/Aucune sortie stdout\./gi, "No stdout output."],
  [/En Python,/gi, "In Python,"],
  [/En Java,/gi, "In Java,"],
  [/En C\+\+,/gi, "In C++,"],
  [/en C\+\+/gi, "in C++"],
  [/en Python/gi, "in Python"],
  [/en Java/gi, "in Java"],
  [/en C,/gi, "in C,"],
];

const starterCodeReplacements = [
  [/Votre code ici/gi, "Write your code here"],
  [/Écrivez votre code ici/gi, "Write your code here"],
  [/Ecrivez votre code ici/gi, "Write your code here"],
  [/fonction ici/gi, "function here"],
];

export function translateQuestionText(text, language = "fr") {
  if (language !== "en") return text;
  if (typeof text !== "string" || text.length === 0) return text;

  const exact = exactChoiceMap.get(text.trim());
  if (exact) return exact;

  const translated = applyReplacements(text, genericReplacements);
  return translated;
}

export function translateStarterCode(starterCode, language = "fr") {
  if (language !== "en") return starterCode;
  if (typeof starterCode !== "string" || starterCode.length === 0) return starterCode;
  return applyReplacements(starterCode, starterCodeReplacements);
}
