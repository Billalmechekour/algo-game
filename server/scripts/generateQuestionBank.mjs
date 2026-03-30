import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QUESTIONS_DIR = path.join(__dirname, "../src/questions");

const LANGUAGES = ["python", "java", "c", "cpp"];
const DIFFICULTIES = ["simple", "medium", "hard"];
const TYPES = ["flash", "code"];
const QUESTIONS_PER_BUCKET = 30;

const POINTS = {
  SIMPLE: { FLASH: 10, CODE: 15 },
  MEDIUM: { FLASH: 15, CODE: 20 },
  HARD: { FLASH: 20, CODE: 25 },
};

const MAX_LINES_BY_DIFFICULTY = {
  SIMPLE: 10,
  MEDIUM: 12,
  HARD: 14,
};

const LANGUAGE_PROFILE = {
  python: {
    display: "Python",
    printSyntax: 'print("Bonjour")',
    commentSyntax: "# ceci est un commentaire",
    trueLiteral: "True",
    andOperator: "and",
    orOperator: "or",
    toIntExpression: 'int("42")',
    stringType: "str",
  },
  java: {
    display: "Java",
    printSyntax: 'System.out.println("Bonjour");',
    commentSyntax: "// ceci est un commentaire",
    trueLiteral: "true",
    andOperator: "&&",
    orOperator: "||",
    toIntExpression: 'Integer.parseInt("42")',
    stringType: "String",
  },
  c: {
    display: "C",
    printSyntax: 'printf("Bonjour\\n");',
    commentSyntax: "// ceci est un commentaire",
    trueLiteral: "1",
    andOperator: "&&",
    orOperator: "||",
    toIntExpression: 'atoi("42")',
    stringType: "char*",
  },
  cpp: {
    display: "C++",
    printSyntax: 'std::cout << "Bonjour" << std::endl;',
    commentSyntax: "// ceci est un commentaire",
    trueLiteral: "true",
    andOperator: "&&",
    orOperator: "||",
    toIntExpression: 'std::stoi("42")',
    stringType: "std::string",
  },
};

const FLASH_TEMPLATES = {
  SIMPLE: [
    (p) => ({
      prompt: `En ${p.display}, quelle instruction affiche du texte dans la console ?`,
      correct: p.printSyntax,
      wrongs: ["print()", "echo()", "Console.WriteLine(\"Bonjour\");"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle syntaxe correspond a un commentaire sur une ligne ?`,
      correct: p.commentSyntax,
      wrongs: ["/* commentaire */", "<!-- commentaire -->", "' commentaire"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle valeur represente VRAI ?`,
      correct: p.trueLiteral,
      wrongs: ["false", "0", "None"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel operateur teste l'egalite entre deux valeurs ?`,
      correct: "==",
      wrongs: ["=", "!=", "=>"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel operateur calcule le modulo ?`,
      correct: "%",
      wrongs: ["/", "//", "**"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel operateur logique signifie ET ?`,
      correct: p.andOperator,
      wrongs: ["||", "==", "!="],
    }),
    (p) => ({
      prompt: `En ${p.display}, l'index du premier element d'un tableau/liste est :`,
      correct: "0",
      wrongs: ["1", "-1", "2"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel mot-cle introduit une condition ?`,
      correct: "if",
      wrongs: ["for", "case", "def"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle boucle est la plus utilisee pour iterer un nombre connu de fois ?`,
      correct: "for",
      wrongs: ["if", "switch", "try"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle expression convertit une chaine "42" en entier ?`,
      correct: p.toIntExpression,
      wrongs: ["toString(42)", "float(\"42\")", "parseBool(\"42\")"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle ecriture incremente x de 1 ?`,
      correct: "x = x + 1",
      wrongs: ["x =+ 1", "x == x + 1", "x := x + 1"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel type est utilise pour manipuler du texte ?`,
      correct: p.stringType,
      wrongs: ["int", "bool", "void"],
    }),
  ],
  MEDIUM: [
    (p) => ({
      prompt: `En ${p.display}, quelle complexite correspond a une recherche lineaire dans un tableau ?`,
      correct: "O(n)",
      wrongs: ["O(1)", "O(log n)", "O(n^2)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle complexite correspond a une recherche binaire sur un tableau trie ?`,
      correct: "O(log n)",
      wrongs: ["O(1)", "O(n)", "O(n log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, une file (queue) suit quel principe ?`,
      correct: "FIFO",
      wrongs: ["LIFO", "FILO", "Aucun ordre"],
    }),
    (p) => ({
      prompt: `En ${p.display}, une pile (stack) suit quel principe ?`,
      correct: "LIFO",
      wrongs: ["FIFO", "FILO", "Aucun ordre"],
    }),
    (p) => ({
      prompt: `En ${p.display}, pourquoi une fonction recursive a-t-elle besoin d'un cas de base ?`,
      correct: "Pour arreter la recursion",
      wrongs: ["Pour accelerer le compilateur", "Pour eviter les variables", "Pour trier les tableaux"],
    }),
    (p) => ({
      prompt: `En ${p.display}, deux boucles imbriquees sur n elements donnent souvent quelle complexite ?`,
      correct: "O(n^2)",
      wrongs: ["O(log n)", "O(1)", "O(n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle structure est adaptee pour associer cle -> valeur ?`,
      correct: "Table de hachage / dictionnaire",
      wrongs: ["Pile", "File", "Tableau fixe"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel algorithme est le plus adapte pour chercher une valeur dans une collection non triee ?`,
      correct: "Recherche lineaire",
      wrongs: ["Recherche binaire", "Dijkstra", "Merge sort"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel est le principal risque d'une condition de boucle mal ecrite ?`,
      correct: "Boucle infinie",
      wrongs: ["Erreur de compilation garantie", "Suppression de variables", "Aucun risque"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel bug represente souvent un probleme de bornes de boucle ?`,
      correct: "Off-by-one",
      wrongs: ["Memory leak", "Deadlock", "Race condition"],
    }),
    (p) => ({
      prompt: `En ${p.display}, que fait un tri stable ?`,
      correct: "Conserve l'ordre relatif des elements egaux",
      wrongs: ["Trie seulement les nombres", "Inverse automatiquement le tableau", "Supprime les doublons"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle notation de complexite ignore les constantes multiplicatives ?`,
      correct: "Big-O",
      wrongs: ["JSON", "ASCII", "UTF-8"],
    }),
  ],
  HARD: [
    (p) => ({
      prompt: `En ${p.display}, quel probleme peut apparaitre avec une recursion trop profonde ?`,
      correct: "Depassement de pile (stack overflow)",
      wrongs: ["Tri automatique", "Compression memoire", "Compilation plus rapide"],
    }),
    (p) => ({
      prompt: `En ${p.display}, dans quels cas la programmation dynamique est-elle utile ?`,
      correct: "Sous-problemes qui se repetent",
      wrongs: ["Aucune boucle", "Seulement les graphes ponderes", "Uniquement les tableaux tries"],
    }),
    (p) => ({
      prompt: `En ${p.display}, pour un graphe non pondere, quel algorithme donne un plus court chemin en nombre d'aretes ?`,
      correct: "BFS",
      wrongs: ["DFS", "Prim", "Kruskal"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel algorithme de plus court chemin suppose des poids non negatifs ?`,
      correct: "Dijkstra",
      wrongs: ["BFS", "Bellman-Ford", "Floyd-Warshall"],
    }),
    (p) => ({
      prompt: `En ${p.display}, la complexite de merge sort est :`,
      correct: "O(n log n)",
      wrongs: ["O(n)", "O(n^2)", "O(log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, en cas de nombreuses collisions, la recherche dans une table de hachage peut degrader vers :`,
      correct: "O(n)",
      wrongs: ["O(1)", "O(log n)", "O(n log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel est l'objectif principal de la memoization ?`,
      correct: "Eviter de recalculer des resultats deja obtenus",
      wrongs: ["Eviter les fonctions", "Compresser les fichiers", "Remplacer les boucles"],
    }),
    (p) => ({
      prompt: `En ${p.display}, un overflow entier signifie :`,
      correct: "Depassement de la plage representable",
      wrongs: ["Suppression automatique de la variable", "Erreur reseau", "Type converti en texte"],
    }),
    (p) => ({
      prompt: `En ${p.display}, une race condition apparait surtout quand :`,
      correct: "Plusieurs executions concurrentes modifient la meme donnee",
      wrongs: ["Un seul thread lit une constante", "Le code ne contient pas de boucle", "Le CPU est lent"],
    }),
    (p) => ({
      prompt: `En ${p.display}, deux boucles de tailles n et m donnent en general :`,
      correct: "O(n * m)",
      wrongs: ["O(n + m) uniquement", "O(1)", "O(log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle strategie divise un probleme en sous-problemes puis combine les resultats ?`,
      correct: "Divide and conquer",
      wrongs: ["Backtracking aveugle", "Random walk", "Greedy sans verification"],
    }),
    (p) => ({
      prompt: `En ${p.display}, dans un graphe dense, quel parcours est souvent plus gourmand en memoire ?`,
      correct: "BFS",
      wrongs: ["DFS", "Aucun des deux", "Les deux utilisent toujours la meme memoire"],
    }),
  ],
};

const FLASH_EXTRA_TEMPLATES = {
  SIMPLE: [
    (p) => ({
      prompt: `En ${p.display}, quel mot-cle permet de sortir immediatement d'une boucle ?`,
      correct: "break",
      wrongs: ["continue", "return", "stop"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel mot-cle passe directement a l'iteration suivante d'une boucle ?`,
      correct: "continue",
      wrongs: ["break", "next", "redo"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel operateur logique signifie OU ?`,
      correct: p.orOperator,
      wrongs: [p.andOperator, "==", "!="],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle structure repete des instructions tant qu'une condition est vraie ?`,
      correct: "while",
      wrongs: ["if", "switch", "class"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel symbole represente une comparaison "strictement superieur" ?`,
      correct: ">",
      wrongs: ["<", ">=", "=="],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel symbole represente une comparaison "inferieur ou egal" ?`,
      correct: "<=",
      wrongs: ["<", ">=", "!="],
    }),
    (p) => ({
      prompt: `En ${p.display}, si l'indexation commence a 0, quel index correspond au 2e element ?`,
      correct: "1",
      wrongs: ["0", "2", "-1"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel est le resultat de l'expression 5 % 2 ?`,
      correct: "1",
      wrongs: ["0", "2", "2.5"],
    }),
  ],
  MEDIUM: [
    (p) => ({
      prompt: `En ${p.display}, quelle est la complexite moyenne d'un tri par insertion ?`,
      correct: "O(n^2)",
      wrongs: ["O(n)", "O(log n)", "O(n log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle est la precondition indispensable pour utiliser une recherche binaire ?`,
      correct: "Le tableau doit etre trie",
      wrongs: ["Le tableau doit etre vide", "Le tableau doit etre de taille paire", "Aucune precondition"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel parcours de graphe utilise naturellement une pile (explicite ou implicite) ?`,
      correct: "DFS",
      wrongs: ["BFS", "Dijkstra", "Kruskal"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel parcours de graphe utilise naturellement une file ?`,
      correct: "BFS",
      wrongs: ["DFS", "A*", "Bellman-Ford"],
    }),
    (p) => ({
      prompt: `En ${p.display}, l'acces moyen a une cle dans une table de hachage bien dimensionnee est plutot :`,
      correct: "O(1)",
      wrongs: ["O(log n)", "O(n)", "O(n^2)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle structure de donnee est la plus adaptee pour implementer une file de priorite ?`,
      correct: "Tas binaire (heap)",
      wrongs: ["Liste chainee simple", "Tableau non trie", "Pile"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel tri repose sur la strategie divide and conquer et combine deux moities triees ?`,
      correct: "Merge sort",
      wrongs: ["Bubble sort", "Selection sort", "Insertion sort"],
    }),
    (p) => ({
      prompt: `En ${p.display}, si on ajoute un element en fin d'un tableau dynamique, la complexite amortie est generalement :`,
      correct: "O(1) amorti",
      wrongs: ["O(log n)", "O(n)", "O(n^2)"],
    }),
  ],
  HARD: [
    (p) => ({
      prompt: `En ${p.display}, quel algorithme de plus court chemin accepte les poids negatifs (sans cycle negatif) ?`,
      correct: "Bellman-Ford",
      wrongs: ["Dijkstra", "BFS", "Prim"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle est la complexite au pire cas de quicksort ?`,
      correct: "O(n^2)",
      wrongs: ["O(n)", "O(log n)", "O(n log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle structure est ideale pour gerer les composantes connexes dynamiques (union/find) ?`,
      correct: "Disjoint Set Union (Union-Find)",
      wrongs: ["Pile", "File", "Tableau 2D"],
    }),
    (p) => ({
      prompt: `En ${p.display}, l'algorithme de Dijkstra peut echouer si le graphe contient :`,
      correct: "Des aretes de poids negatifs",
      wrongs: ["Des sommets isoles", "Des cycles", "Des aretes non orientees"],
    }),
    (p) => ({
      prompt: `En ${p.display}, la memoization en programmation dynamique est une approche :`,
      correct: "Top-down avec cache",
      wrongs: ["Bottom-up sans tableau", "Tri de tableau", "Parcours en largeur"],
    }),
    (p) => ({
      prompt: `En ${p.display}, Floyd-Warshall permet principalement de calculer :`,
      correct: "Les plus courts chemins entre toutes les paires de sommets",
      wrongs: ["Un arbre couvrant minimal", "Un tri topologique", "Un parcours en profondeur"],
    }),
    (p) => ({
      prompt: `En ${p.display}, dans un backtracking efficace, que fait le pruning ?`,
      correct: "Elimine des branches impossibles ou non optimales",
      wrongs: ["Ajoute des branches aleatoires", "Transforme DFS en BFS", "Remplace la recursion par une boucle for"],
    }),
    (p) => ({
      prompt: `En ${p.display}, pour detecter un cycle dans un graphe oriente, quelle methode est classique ?`,
      correct: "DFS avec etats de visite (blanc/gris/noir)",
      wrongs: ["BFS sans tableau de visite", "Tri par selection", "Recherche binaire"],
    }),
  ],
};

const FLASH_BONUS_TEMPLATES = {
  SIMPLE: [
    (p) => ({
      prompt: `En ${p.display}, quel mot-cle permet de renvoyer une valeur depuis une fonction ?`,
      correct: "return",
      wrongs: ["break", "continue", "yield"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel operateur signifie "different de" ?`,
      correct: "!=",
      wrongs: ["==", "<>", "=>"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel est le resultat de 3 * 4 + 1 ?`,
      correct: "13",
      wrongs: ["12", "15", "7"],
    }),
    (p) => ({
      prompt: `En ${p.display}, comment appelle-t-on l'erreur liee a un acces hors limites d'un tableau ?`,
      correct: "Depassement de limites (out-of-bounds)",
      wrongs: ["Deadlock", "Race condition", "Garbage collection"],
    }),
  ],
  MEDIUM: [
    (p) => ({
      prompt: `En ${p.display}, parcourir completement une matrice n x n a une complexite en :`,
      correct: "O(n^2)",
      wrongs: ["O(n)", "O(log n)", "O(n log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel tri classique est stable par nature (implementation standard) ?`,
      correct: "Insertion sort",
      wrongs: ["Selection sort", "Heap sort", "Quick sort"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle structure est la plus adaptee pour gerer un mecanisme Annuler/Refaire ?`,
      correct: "Pile (stack)",
      wrongs: ["File (queue)", "Arbre binaire", "Tableau trie"],
    }),
    (p) => ({
      prompt: `En ${p.display}, supprimer le premier element d'une liste chainee simplement chainee est en moyenne :`,
      correct: "O(1)",
      wrongs: ["O(log n)", "O(n)", "O(n^2)"],
    }),
  ],
  HARD: [
    (p) => ({
      prompt: `En ${p.display}, un tri topologique est defini uniquement pour quel type de graphe ?`,
      correct: "Graphe oriente acyclique (DAG)",
      wrongs: ["Graphe non oriente quelconque", "Graphe avec cycle negatif", "Arbre binaire complet"],
    }),
    (p) => ({
      prompt: `En ${p.display}, la complexite temporelle classique de Floyd-Warshall est :`,
      correct: "O(n^3)",
      wrongs: ["O(n^2)", "O(n log n)", "O(log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, dans un graphe avec cycle negatif atteignable, que devient la notion de plus court chemin ?`,
      correct: "Elle peut devenir non definie",
      wrongs: ["Elle reste toujours unique", "Elle vaut toujours 0", "Elle est identique a BFS"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel est l'avantage principal du backtracking par rapport a la force brute naive ?`,
      correct: "Il elimine des branches inutiles (pruning)",
      wrongs: ["Il evite toute recursion", "Il garantit O(log n)", "Il trie automatiquement les donnees"],
    }),
  ],
};

const FLASH_SUPER_TEMPLATES = {
  SIMPLE: [
    (p) => ({
      prompt: `En ${p.display}, quel mot-cle execute un bloc si la condition est fausse ?`,
      correct: "else",
      wrongs: ["elif", "while", "case"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel separateur est utilise entre deux parametres de fonction ?`,
      correct: ",",
      wrongs: [";", ":", "."],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel est le resultat de 2 + 3 * 2 ?`,
      correct: "8",
      wrongs: ["10", "12", "7"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel symbole compare "strictement inferieur" ?`,
      correct: "<",
      wrongs: ["<=", ">", "=="],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle instruction initialise une variable compteur a zero ?`,
      correct: "count = 0",
      wrongs: ["count == 0", "count = count + 1", "count = None"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle structure de donnees est indexee et ordonnee ?`,
      correct: "Tableau / liste",
      wrongs: ["Set non ordonne", "Pile", "File de priorite"],
    }),
  ],
  MEDIUM: [
    (p) => ({
      prompt: `En ${p.display}, parcourir une fois un tableau de n elements a une complexite de :`,
      correct: "O(n)",
      wrongs: ["O(1)", "O(log n)", "O(n^2)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quel type de structure est utilisee par BFS pour gerer les noeuds a visiter ?`,
      correct: "File (queue)",
      wrongs: ["Pile (stack)", "Tas", "Table de hachage"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle est la complexite moyenne du tri a bulles ?`,
      correct: "O(n^2)",
      wrongs: ["O(n)", "O(log n)", "O(n log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, dans une recherche binaire, si la cible est plus grande que le milieu, on fait :`,
      correct: "left = mid + 1",
      wrongs: ["right = mid - 1", "mid = 0", "On recommence depuis le debut"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle est la complexite moyenne d'insertion dans un dictionnaire/table de hachage ?`,
      correct: "O(1)",
      wrongs: ["O(log n)", "O(n)", "O(n^2)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, une fonction iterative est souvent preferee a la recursion profonde pour limiter :`,
      correct: "La consommation de pile",
      wrongs: ["La taille des entiers", "Le nombre de variables globales", "La vitesse du disque"],
    }),
  ],
  HARD: [
    (p) => ({
      prompt: `En ${p.display}, si T(n)=2T(n/2)+n, la complexite est :`,
      correct: "O(n log n)",
      wrongs: ["O(n)", "O(n^2)", "O(log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, un tri topologique est possible uniquement sur :`,
      correct: "Un graphe oriente acyclique (DAG)",
      wrongs: ["Un graphe non oriente", "Un graphe avec cycle negatif", "Une matrice creuse"],
    }),
    (p) => ({
      prompt: `En ${p.display}, la suppression du minimum dans un tas binaire a une complexite de :`,
      correct: "O(log n)",
      wrongs: ["O(1)", "O(n)", "O(n log n)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, la complexite classique de Bellman-Ford est :`,
      correct: "O(V * E)",
      wrongs: ["O(V + E)", "O(E log V)", "O(V^2)"],
    }),
    (p) => ({
      prompt: `En ${p.display}, quelle structure permet des requetes de somme sur intervalle en O(log n) avec mises a jour ?`,
      correct: "Segment tree",
      wrongs: ["Pile", "File", "Recherche lineaire"],
    }),
    (p) => ({
      prompt: `En ${p.display}, une memoization efficace repose surtout sur :`,
      correct: "Une cle unique representant l'etat du sous-probleme",
      wrongs: ["Un tri prealable obligatoire", "La suppression des conditions", "L'utilisation exclusive de boucles for"],
    }),
  ],
};

const CODE_TASKS = {
  SIMPLE: [
    {
      functionName: "add_numbers",
      prompt: "Ecrivez une fonction qui retourne la somme de deux entiers.",
      params: ["a", "b"],
      tests: [
        { input: "add_numbers(2, 3)", expected: "5", description: "2 + 3" },
        { input: "add_numbers(-4, 10)", expected: "6", description: "-4 + 10" },
        { input: "add_numbers(0, 0)", expected: "0", description: "0 + 0" },
      ],
    },
    {
      functionName: "multiply_numbers",
      prompt: "Ecrivez une fonction qui retourne le produit de deux entiers.",
      params: ["a", "b"],
      tests: [
        { input: "multiply_numbers(4, 5)", expected: "20", description: "4 * 5" },
        { input: "multiply_numbers(-3, 2)", expected: "-6", description: "-3 * 2" },
        { input: "multiply_numbers(0, 9)", expected: "0", description: "0 * 9" },
      ],
    },
    {
      functionName: "square_number",
      prompt: "Ecrivez une fonction qui retourne le carre d'un entier.",
      params: ["n"],
      tests: [
        { input: "square_number(6)", expected: "36", description: "6^2" },
        { input: "square_number(-3)", expected: "9", description: "(-3)^2" },
        { input: "square_number(0)", expected: "0", description: "0^2" },
      ],
    },
    {
      functionName: "max_of_two",
      prompt: "Ecrivez une fonction qui retourne le maximum de deux entiers.",
      params: ["a", "b"],
      tests: [
        { input: "max_of_two(8, 5)", expected: "8", description: "max(8,5)" },
        { input: "max_of_two(-1, 4)", expected: "4", description: "max(-1,4)" },
        { input: "max_of_two(7, 7)", expected: "7", description: "max(7,7)" },
      ],
    },
    {
      functionName: "min_of_two",
      prompt: "Ecrivez une fonction qui retourne le minimum de deux entiers.",
      params: ["a", "b"],
      tests: [
        { input: "min_of_two(8, 5)", expected: "5", description: "min(8,5)" },
        { input: "min_of_two(-1, 4)", expected: "-1", description: "min(-1,4)" },
        { input: "min_of_two(7, 7)", expected: "7", description: "min(7,7)" },
      ],
    },
    {
      functionName: "abs_value",
      prompt: "Ecrivez une fonction qui retourne la valeur absolue d'un entier.",
      params: ["n"],
      tests: [
        { input: "abs_value(-9)", expected: "9", description: "|-9|" },
        { input: "abs_value(3)", expected: "3", description: "|3|" },
        { input: "abs_value(0)", expected: "0", description: "|0|" },
      ],
    },
    {
      functionName: "is_even_int",
      prompt: "Ecrivez une fonction qui retourne 1 si l'entier est pair, sinon 0.",
      params: ["n"],
      tests: [
        { input: "is_even_int(12)", expected: "1", description: "12 est pair" },
        { input: "is_even_int(7)", expected: "0", description: "7 est impair" },
        { input: "is_even_int(0)", expected: "1", description: "0 est pair" },
      ],
    },
    {
      functionName: "sum_to_n",
      prompt: "Ecrivez une fonction qui retourne la somme des entiers de 1 a n (n >= 0).",
      params: ["n"],
      tests: [
        { input: "sum_to_n(5)", expected: "15", description: "1+2+3+4+5" },
        { input: "sum_to_n(1)", expected: "1", description: "n=1" },
        { input: "sum_to_n(0)", expected: "0", description: "n=0" },
      ],
    },
    {
      functionName: "digit_count",
      prompt: "Ecrivez une fonction qui retourne le nombre de chiffres d'un entier (en valeur absolue).",
      params: ["n"],
      tests: [
        { input: "digit_count(12345)", expected: "5", description: "5 chiffres" },
        { input: "digit_count(-99)", expected: "2", description: "2 chiffres" },
        { input: "digit_count(0)", expected: "1", description: "0 a 1 chiffre" },
      ],
    },
    {
      functionName: "clamp_0_100",
      prompt: "Ecrivez une fonction qui borne une valeur entre 0 et 100.",
      params: ["n"],
      tests: [
        { input: "clamp_0_100(-5)", expected: "0", description: "borne basse" },
        { input: "clamp_0_100(45)", expected: "45", description: "dans l'intervalle" },
        { input: "clamp_0_100(120)", expected: "100", description: "borne haute" },
      ],
    },
    {
      functionName: "reverse_sign",
      prompt: "Ecrivez une fonction qui inverse le signe d'un entier.",
      params: ["n"],
      tests: [
        { input: "reverse_sign(7)", expected: "-7", description: "positif -> negatif" },
        { input: "reverse_sign(-4)", expected: "4", description: "negatif -> positif" },
        { input: "reverse_sign(0)", expected: "0", description: "0" },
      ],
    },
    {
      functionName: "average_floor",
      prompt: "Ecrivez une fonction qui retourne la moyenne entiere (arrondie vers le bas) de trois entiers.",
      params: ["a", "b", "c"],
      tests: [
        { input: "average_floor(3, 4, 5)", expected: "4", description: "(3+4+5)/3" },
        { input: "average_floor(1, 2, 2)", expected: "1", description: "5/3 = 1" },
        { input: "average_floor(10, 10, 10)", expected: "10", description: "moyenne exacte" },
      ],
    },
  ],
  MEDIUM: [
    {
      functionName: "gcd",
      prompt: "Ecrivez une fonction qui retourne le PGCD de deux entiers positifs.",
      params: ["a", "b"],
      tests: [
        { input: "gcd(12, 18)", expected: "6", description: "PGCD(12,18)" },
        { input: "gcd(100, 25)", expected: "25", description: "PGCD(100,25)" },
        { input: "gcd(17, 13)", expected: "1", description: "nombres premiers entre eux" },
      ],
    },
    {
      functionName: "lcm",
      prompt: "Ecrivez une fonction qui retourne le PPCM de deux entiers positifs.",
      params: ["a", "b"],
      tests: [
        { input: "lcm(4, 6)", expected: "12", description: "PPCM(4,6)" },
        { input: "lcm(5, 7)", expected: "35", description: "PPCM(5,7)" },
        { input: "lcm(3, 9)", expected: "9", description: "PPCM(3,9)" },
      ],
    },
    {
      functionName: "fibonacci",
      prompt: "Ecrivez une fonction qui retourne le n-ieme terme de Fibonacci (F0=0, F1=1).",
      params: ["n"],
      tests: [
        { input: "fibonacci(0)", expected: "0", description: "F0" },
        { input: "fibonacci(7)", expected: "13", description: "F7" },
        { input: "fibonacci(10)", expected: "55", description: "F10" },
      ],
    },
    {
      functionName: "sum_digits",
      prompt: "Ecrivez une fonction qui retourne la somme des chiffres d'un entier (en valeur absolue).",
      params: ["n"],
      tests: [
        { input: "sum_digits(1234)", expected: "10", description: "1+2+3+4" },
        { input: "sum_digits(-909)", expected: "18", description: "9+0+9" },
        { input: "sum_digits(0)", expected: "0", description: "0" },
      ],
    },
    {
      functionName: "is_prime_int",
      prompt: "Ecrivez une fonction qui retourne 1 si n est premier, sinon 0.",
      params: ["n"],
      tests: [
        { input: "is_prime_int(2)", expected: "1", description: "2 premier" },
        { input: "is_prime_int(9)", expected: "0", description: "9 non premier" },
        { input: "is_prime_int(29)", expected: "1", description: "29 premier" },
      ],
    },
    {
      functionName: "next_prime",
      prompt: "Ecrivez une fonction qui retourne le plus petit nombre premier strictement superieur a n.",
      params: ["n"],
      tests: [
        { input: "next_prime(3)", expected: "5", description: "apres 3" },
        { input: "next_prime(14)", expected: "17", description: "apres 14" },
        { input: "next_prime(29)", expected: "31", description: "apres 29" },
      ],
    },
    {
      functionName: "power_int",
      prompt: "Ecrivez une fonction qui calcule base^exp avec exp >= 0.",
      params: ["base", "exp"],
      tests: [
        { input: "power_int(2, 5)", expected: "32", description: "2^5" },
        { input: "power_int(7, 0)", expected: "1", description: "puissance zero" },
        { input: "power_int(3, 3)", expected: "27", description: "3^3" },
      ],
    },
    {
      functionName: "count_divisors",
      prompt: "Ecrivez une fonction qui retourne le nombre de diviseurs positifs de n (n > 0).",
      params: ["n"],
      tests: [
        { input: "count_divisors(1)", expected: "1", description: "diviseurs de 1" },
        { input: "count_divisors(12)", expected: "6", description: "1,2,3,4,6,12" },
        { input: "count_divisors(13)", expected: "2", description: "premier" },
      ],
    },
    {
      functionName: "reverse_number",
      prompt: "Ecrivez une fonction qui retourne l'entier obtenu en inversant les chiffres d'un nombre positif.",
      params: ["n"],
      tests: [
        { input: "reverse_number(1234)", expected: "4321", description: "inverse" },
        { input: "reverse_number(900)", expected: "9", description: "zeros terminaux" },
        { input: "reverse_number(5)", expected: "5", description: "un chiffre" },
      ],
    },
    {
      functionName: "is_palindrome_number",
      prompt: "Ecrivez une fonction qui retourne 1 si un entier positif est palindrome, sinon 0.",
      params: ["n"],
      tests: [
        { input: "is_palindrome_number(1221)", expected: "1", description: "palindrome" },
        { input: "is_palindrome_number(123)", expected: "0", description: "non palindrome" },
        { input: "is_palindrome_number(7)", expected: "1", description: "un chiffre" },
      ],
    },
    {
      functionName: "count_set_bits",
      prompt: "Ecrivez une fonction qui retourne le nombre de bits a 1 dans un entier n >= 0.",
      params: ["n"],
      tests: [
        { input: "count_set_bits(0)", expected: "0", description: "0" },
        { input: "count_set_bits(7)", expected: "3", description: "111b" },
        { input: "count_set_bits(10)", expected: "2", description: "1010b" },
      ],
    },
    {
      functionName: "sum_of_squares",
      prompt: "Ecrivez une fonction qui retourne la somme des carres de 1 a n (n >= 0).",
      params: ["n"],
      tests: [
        { input: "sum_of_squares(3)", expected: "14", description: "1^2+2^2+3^2" },
        { input: "sum_of_squares(5)", expected: "55", description: "jusqu'a 5" },
        { input: "sum_of_squares(0)", expected: "0", description: "n=0" },
      ],
    },
  ],
  HARD: [
    {
      functionName: "tribonacci",
      prompt: "Ecrivez une fonction qui retourne Tn de Tribonacci avec T0=0, T1=1, T2=1.",
      params: ["n"],
      tests: [
        { input: "tribonacci(0)", expected: "0", description: "T0" },
        { input: "tribonacci(4)", expected: "4", description: "T4" },
        { input: "tribonacci(7)", expected: "24", description: "T7" },
      ],
    },
    {
      functionName: "collatz_steps",
      prompt: "Ecrivez une fonction qui retourne le nombre d'etapes de la suite de Collatz pour atteindre 1.",
      params: ["n"],
      tests: [
        { input: "collatz_steps(1)", expected: "0", description: "deja 1" },
        { input: "collatz_steps(6)", expected: "8", description: "6->...->1" },
        { input: "collatz_steps(7)", expected: "16", description: "7->...->1" },
      ],
    },
    {
      functionName: "sum_even_fibonacci",
      prompt: "Ecrivez une fonction qui retourne la somme des termes pairs de Fibonacci inferieurs ou egaux a limit.",
      params: ["limit"],
      tests: [
        { input: "sum_even_fibonacci(1)", expected: "0", description: "aucun terme pair" },
        { input: "sum_even_fibonacci(10)", expected: "10", description: "2 + 8" },
        { input: "sum_even_fibonacci(34)", expected: "44", description: "2 + 8 + 34" },
      ],
    },
    {
      functionName: "largest_prime_factor",
      prompt: "Ecrivez une fonction qui retourne le plus grand facteur premier d'un entier n > 1.",
      params: ["n"],
      tests: [
        { input: "largest_prime_factor(13195)", expected: "29", description: "exemple classique" },
        { input: "largest_prime_factor(84)", expected: "7", description: "facteurs de 84" },
        { input: "largest_prime_factor(97)", expected: "97", description: "n deja premier" },
      ],
    },
    {
      functionName: "digital_root",
      prompt: "Ecrivez une fonction qui retourne la racine numerique d'un entier positif.",
      params: ["n"],
      tests: [
        { input: "digital_root(0)", expected: "0", description: "cas zero" },
        { input: "digital_root(38)", expected: "2", description: "3+8=11, 1+1=2" },
        { input: "digital_root(9999)", expected: "9", description: "racine numerique" },
      ],
    },
    {
      functionName: "trailing_zeros_factorial",
      prompt: "Ecrivez une fonction qui retourne le nombre de zeros a la fin de n!.",
      params: ["n"],
      tests: [
        { input: "trailing_zeros_factorial(5)", expected: "1", description: "5! = 120" },
        { input: "trailing_zeros_factorial(10)", expected: "2", description: "10!" },
        { input: "trailing_zeros_factorial(25)", expected: "6", description: "25!" },
      ],
    },
    {
      functionName: "integer_sqrt_floor",
      prompt: "Ecrivez une fonction qui retourne la racine carree entiere (partie entiere) de n >= 0.",
      params: ["n"],
      tests: [
        { input: "integer_sqrt_floor(0)", expected: "0", description: "sqrt(0)" },
        { input: "integer_sqrt_floor(10)", expected: "3", description: "floor(sqrt(10))" },
        { input: "integer_sqrt_floor(81)", expected: "9", description: "sqrt(81)" },
      ],
    },
    {
      functionName: "count_digit_occurrences",
      prompt: "Ecrivez une fonction qui compte le nombre d'occurrences du chiffre d dans l'entier n (en valeur absolue).",
      params: ["n", "d"],
      tests: [
        { input: "count_digit_occurrences(122333, 3)", expected: "3", description: "trois fois 3" },
        { input: "count_digit_occurrences(1000, 0)", expected: "3", description: "trois zeros" },
        { input: "count_digit_occurrences(987, 1)", expected: "0", description: "absence" },
      ],
    },
    {
      functionName: "sum_proper_divisors",
      prompt: "Ecrivez une fonction qui retourne la somme des diviseurs propres de n (hors n lui-meme).",
      params: ["n"],
      tests: [
        { input: "sum_proper_divisors(1)", expected: "0", description: "aucun diviseur propre" },
        { input: "sum_proper_divisors(6)", expected: "6", description: "1+2+3" },
        { input: "sum_proper_divisors(12)", expected: "16", description: "1+2+3+4+6" },
      ],
    },
    {
      functionName: "is_perfect_number",
      prompt: "Ecrivez une fonction qui retourne 1 si n est un nombre parfait, sinon 0.",
      params: ["n"],
      tests: [
        { input: "is_perfect_number(6)", expected: "1", description: "6 est parfait" },
        { input: "is_perfect_number(28)", expected: "1", description: "28 est parfait" },
        { input: "is_perfect_number(12)", expected: "0", description: "12 non parfait" },
      ],
    },
    {
      functionName: "staircase_ways",
      prompt: "Ecrivez une fonction qui retourne le nombre de facons de monter n marches en faisant des pas de 1 ou 2.",
      params: ["n"],
      tests: [
        { input: "staircase_ways(0)", expected: "1", description: "une facon de rester en bas" },
        { input: "staircase_ways(4)", expected: "5", description: "n=4" },
        { input: "staircase_ways(6)", expected: "13", description: "n=6" },
      ],
    },
    {
      functionName: "binary_digits_to_decimal",
      prompt: "Ecrivez une fonction qui convertit un entier compose de chiffres binaires (ex: 1011) vers le decimal.",
      params: ["binary_digits"],
      tests: [
        { input: "binary_digits_to_decimal(0)", expected: "0", description: "0b" },
        { input: "binary_digits_to_decimal(1011)", expected: "11", description: "1011b" },
        { input: "binary_digits_to_decimal(111111)", expected: "63", description: "111111b" },
      ],
    },
  ],
};

const CODE_EXTRA_TASKS = {
  SIMPLE: [
    {
      functionName: "subtract_numbers",
      prompt: "Ecrivez une fonction qui retourne la difference a - b.",
      params: ["a", "b"],
      tests: [
        { input: "subtract_numbers(9, 4)", expected: "5", description: "9 - 4" },
        { input: "subtract_numbers(-2, 5)", expected: "-7", description: "-2 - 5" },
        { input: "subtract_numbers(0, 0)", expected: "0", description: "0 - 0" },
      ],
    },
    {
      functionName: "is_positive",
      prompt: "Ecrivez une fonction qui retourne 1 si n > 0, sinon 0.",
      params: ["n"],
      tests: [
        { input: "is_positive(4)", expected: "1", description: "positif" },
        { input: "is_positive(-1)", expected: "0", description: "negatif" },
        { input: "is_positive(0)", expected: "0", description: "zero" },
      ],
    },
    {
      functionName: "max_of_three",
      prompt: "Ecrivez une fonction qui retourne le maximum de trois entiers.",
      params: ["a", "b", "c"],
      tests: [
        { input: "max_of_three(2, 9, 4)", expected: "9", description: "max de 2,9,4" },
        { input: "max_of_three(-1, -7, -3)", expected: "-1", description: "max negatif" },
        { input: "max_of_three(5, 5, 1)", expected: "5", description: "egalite" },
      ],
    },
    {
      functionName: "min_of_three",
      prompt: "Ecrivez une fonction qui retourne le minimum de trois entiers.",
      params: ["a", "b", "c"],
      tests: [
        { input: "min_of_three(2, 9, 4)", expected: "2", description: "min de 2,9,4" },
        { input: "min_of_three(-1, -7, -3)", expected: "-7", description: "min negatif" },
        { input: "min_of_three(5, 5, 1)", expected: "1", description: "minimum unique" },
      ],
    },
    {
      functionName: "cube_number",
      prompt: "Ecrivez une fonction qui retourne le cube d'un entier.",
      params: ["n"],
      tests: [
        { input: "cube_number(3)", expected: "27", description: "3^3" },
        { input: "cube_number(-2)", expected: "-8", description: "(-2)^3" },
        { input: "cube_number(0)", expected: "0", description: "0^3" },
      ],
    },
    {
      functionName: "double_number",
      prompt: "Ecrivez une fonction qui retourne le double d'un entier.",
      params: ["n"],
      tests: [
        { input: "double_number(9)", expected: "18", description: "double de 9" },
        { input: "double_number(-4)", expected: "-8", description: "double negatif" },
        { input: "double_number(0)", expected: "0", description: "double de 0" },
      ],
    },
    {
      functionName: "remainder_int",
      prompt: "Ecrivez une fonction qui retourne le reste de a divise par b. Si b vaut 0, retournez 0.",
      params: ["a", "b"],
      tests: [
        { input: "remainder_int(10, 3)", expected: "1", description: "10 % 3" },
        { input: "remainder_int(14, 7)", expected: "0", description: "multiple exact" },
        { input: "remainder_int(5, 0)", expected: "0", description: "division par zero protegee" },
      ],
    },
    {
      functionName: "is_multiple",
      prompt: "Ecrivez une fonction qui retourne 1 si a est multiple de b (et b != 0), sinon 0.",
      params: ["a", "b"],
      tests: [
        { input: "is_multiple(21, 7)", expected: "1", description: "21 multiple de 7" },
        { input: "is_multiple(22, 7)", expected: "0", description: "22 non multiple de 7" },
        { input: "is_multiple(5, 0)", expected: "0", description: "cas b=0" },
      ],
    },
  ],
  MEDIUM: [
    {
      functionName: "factorial_iter",
      prompt: "Ecrivez une fonction qui retourne n! pour n >= 0.",
      params: ["n"],
      tests: [
        { input: "factorial_iter(0)", expected: "1", description: "0!" },
        { input: "factorial_iter(5)", expected: "120", description: "5!" },
        { input: "factorial_iter(7)", expected: "5040", description: "7!" },
      ],
    },
    {
      functionName: "nth_even",
      prompt: "Ecrivez une fonction qui retourne le n-ieme nombre pair (n >= 0).",
      params: ["n"],
      tests: [
        { input: "nth_even(0)", expected: "0", description: "premier pair" },
        { input: "nth_even(4)", expected: "8", description: "5e pair en partant de 0" },
        { input: "nth_even(10)", expected: "20", description: "11e pair en partant de 0" },
      ],
    },
    {
      functionName: "arithmetic_sum",
      prompt: "Ecrivez une fonction qui retourne la somme des n premiers termes d'une suite arithmetique de premier terme a1 et de raison d.",
      params: ["a1", "d", "n"],
      tests: [
        { input: "arithmetic_sum(1, 1, 5)", expected: "15", description: "1+2+3+4+5" },
        { input: "arithmetic_sum(3, 2, 4)", expected: "24", description: "3+5+7+9" },
        { input: "arithmetic_sum(10, 0, 3)", expected: "30", description: "suite constante" },
      ],
    },
    {
      functionName: "gcd_three",
      prompt: "Ecrivez une fonction qui retourne le PGCD de trois entiers positifs.",
      params: ["a", "b", "c"],
      tests: [
        { input: "gcd_three(12, 18, 30)", expected: "6", description: "PGCD commun" },
        { input: "gcd_three(7, 13, 29)", expected: "1", description: "premiers entre eux" },
        { input: "gcd_three(20, 30, 40)", expected: "10", description: "PGCD 10" },
      ],
    },
    {
      functionName: "is_power_of_two",
      prompt: "Ecrivez une fonction qui retourne 1 si n est une puissance de 2, sinon 0.",
      params: ["n"],
      tests: [
        { input: "is_power_of_two(1)", expected: "1", description: "2^0" },
        { input: "is_power_of_two(16)", expected: "1", description: "2^4" },
        { input: "is_power_of_two(18)", expected: "0", description: "pas puissance de 2" },
      ],
    },
    {
      functionName: "sum_even_digits",
      prompt: "Ecrivez une fonction qui retourne la somme des chiffres pairs de n (en valeur absolue).",
      params: ["n"],
      tests: [
        { input: "sum_even_digits(123456)", expected: "12", description: "2+4+6" },
        { input: "sum_even_digits(135)", expected: "0", description: "aucun chiffre pair" },
        { input: "sum_even_digits(-9082)", expected: "10", description: "8+0+2" },
      ],
    },
    {
      functionName: "count_digit_value",
      prompt: "Ecrivez une fonction qui compte le nombre d'occurrences du chiffre d dans n (en valeur absolue).",
      params: ["n", "d"],
      tests: [
        { input: "count_digit_value(122333, 3)", expected: "3", description: "trois fois 3" },
        { input: "count_digit_value(1001, 0)", expected: "2", description: "deux zeros" },
        { input: "count_digit_value(987, 1)", expected: "0", description: "absence de 1" },
      ],
    },
    {
      functionName: "smallest_multiple_ge",
      prompt: "Ecrivez une fonction qui retourne le plus petit multiple de m superieur ou egal a n (m > 0).",
      params: ["n", "m"],
      tests: [
        { input: "smallest_multiple_ge(10, 4)", expected: "12", description: "multiple suivant" },
        { input: "smallest_multiple_ge(15, 5)", expected: "15", description: "deja multiple" },
        { input: "smallest_multiple_ge(1, 7)", expected: "7", description: "premier multiple >= 1" },
      ],
    },
  ],
  HARD: [
    {
      functionName: "josephus_two",
      prompt: "Ecrivez une fonction qui retourne le survivant du probleme de Josephus pour n personnes et un pas k=2 (indexation a partir de 1).",
      params: ["n"],
      tests: [
        { input: "josephus_two(1)", expected: "1", description: "n=1" },
        { input: "josephus_two(5)", expected: "3", description: "n=5" },
        { input: "josephus_two(10)", expected: "5", description: "n=10" },
      ],
    },
    {
      functionName: "fast_power_mod",
      prompt: "Ecrivez une fonction qui retourne (base^exp) % mod avec exp >= 0 et mod > 0.",
      params: ["base", "exp", "mod"],
      tests: [
        { input: "fast_power_mod(2, 10, 1000)", expected: "24", description: "1024 % 1000" },
        { input: "fast_power_mod(7, 0, 13)", expected: "1", description: "puissance zero" },
        { input: "fast_power_mod(5, 5, 7)", expected: "3", description: "3125 % 7" },
      ],
    },
    {
      functionName: "catalan_number",
      prompt: "Ecrivez une fonction qui retourne le n-ieme nombre de Catalan (n >= 0).",
      params: ["n"],
      tests: [
        { input: "catalan_number(0)", expected: "1", description: "C0" },
        { input: "catalan_number(3)", expected: "5", description: "C3" },
        { input: "catalan_number(5)", expected: "42", description: "C5" },
      ],
    },
    {
      functionName: "count_trailing_ones_binary",
      prompt: "Ecrivez une fonction qui retourne le nombre de bits a 1 consecutifs a la fin de l'ecriture binaire de n (n >= 0).",
      params: ["n"],
      tests: [
        { input: "count_trailing_ones_binary(0)", expected: "0", description: "0b0" },
        { input: "count_trailing_ones_binary(7)", expected: "3", description: "111b" },
        { input: "count_trailing_ones_binary(13)", expected: "1", description: "1101b" },
      ],
    },
    {
      functionName: "sum_multiples_3_or_5",
      prompt: "Ecrivez une fonction qui retourne la somme des entiers strictement inferieurs a limit qui sont multiples de 3 ou de 5.",
      params: ["limit"],
      tests: [
        { input: "sum_multiples_3_or_5(10)", expected: "23", description: "3+5+6+9" },
        { input: "sum_multiples_3_or_5(1)", expected: "0", description: "aucun entier" },
        { input: "sum_multiples_3_or_5(16)", expected: "60", description: "somme < 16" },
      ],
    },
    {
      functionName: "next_palindrome_number",
      prompt: "Ecrivez une fonction qui retourne le plus petit palindrome decimal superieur ou egal a n.",
      params: ["n"],
      tests: [
        { input: "next_palindrome_number(123)", expected: "131", description: "palindrome suivant" },
        { input: "next_palindrome_number(99)", expected: "99", description: "deja palindrome" },
        { input: "next_palindrome_number(808)", expected: "808", description: "deja palindrome 3 chiffres" },
      ],
    },
    {
      functionName: "integer_log2_floor",
      prompt: "Ecrivez une fonction qui retourne floor(log2(n)) pour n > 0. Pour n <= 0, retournez 0.",
      params: ["n"],
      tests: [
        { input: "integer_log2_floor(1)", expected: "0", description: "log2(1)" },
        { input: "integer_log2_floor(16)", expected: "4", description: "log2(16)" },
        { input: "integer_log2_floor(31)", expected: "4", description: "floor(log2(31))" },
      ],
    },
    {
      functionName: "is_armstrong_3",
      prompt: "Ecrivez une fonction qui retourne 1 si n est un nombre d'Armstrong a 3 chiffres, sinon 0.",
      params: ["n"],
      tests: [
        { input: "is_armstrong_3(153)", expected: "1", description: "153 est Armstrong" },
        { input: "is_armstrong_3(370)", expected: "1", description: "370 est Armstrong" },
        { input: "is_armstrong_3(200)", expected: "0", description: "200 non Armstrong" },
      ],
    },
  ],
};

const CODE_BONUS_TASKS = {
  SIMPLE: [
    {
      functionName: "increment_by_k",
      prompt: "Ecrivez une fonction qui retourne n augmente de k.",
      params: ["n", "k"],
      tests: [
        { input: "increment_by_k(5, 3)", expected: "8", description: "5 + 3" },
        { input: "increment_by_k(-2, 10)", expected: "8", description: "-2 + 10" },
        { input: "increment_by_k(0, 0)", expected: "0", description: "0 + 0" },
      ],
    },
    {
      functionName: "distance_abs",
      prompt: "Ecrivez une fonction qui retourne la distance absolue entre deux entiers a et b.",
      params: ["a", "b"],
      tests: [
        { input: "distance_abs(10, 4)", expected: "6", description: "|10-4|" },
        { input: "distance_abs(-3, 5)", expected: "8", description: "|-3-5|" },
        { input: "distance_abs(7, 7)", expected: "0", description: "|7-7|" },
      ],
    },
    {
      functionName: "sum_three",
      prompt: "Ecrivez une fonction qui retourne la somme de trois entiers.",
      params: ["a", "b", "c"],
      tests: [
        { input: "sum_three(1, 2, 3)", expected: "6", description: "1+2+3" },
        { input: "sum_three(-1, 4, 0)", expected: "3", description: "-1+4+0" },
        { input: "sum_three(10, 10, 10)", expected: "30", description: "10+10+10" },
      ],
    },
    {
      functionName: "is_zero",
      prompt: "Ecrivez une fonction qui retourne 1 si n vaut 0, sinon 0.",
      params: ["n"],
      tests: [
        { input: "is_zero(0)", expected: "1", description: "n=0" },
        { input: "is_zero(5)", expected: "0", description: "n positif" },
        { input: "is_zero(-3)", expected: "0", description: "n negatif" },
      ],
    },
  ],
  MEDIUM: [
    {
      functionName: "sum_odd_to_n",
      prompt: "Ecrivez une fonction qui retourne la somme des entiers impairs de 1 a n (n >= 0).",
      params: ["n"],
      tests: [
        { input: "sum_odd_to_n(1)", expected: "1", description: "1" },
        { input: "sum_odd_to_n(7)", expected: "16", description: "1+3+5+7" },
        { input: "sum_odd_to_n(10)", expected: "25", description: "1+3+5+7+9" },
      ],
    },
    {
      functionName: "triangle_number",
      prompt: "Ecrivez une fonction qui retourne le n-ieme nombre triangulaire: n*(n+1)/2.",
      params: ["n"],
      tests: [
        { input: "triangle_number(0)", expected: "0", description: "n=0" },
        { input: "triangle_number(5)", expected: "15", description: "5*6/2" },
        { input: "triangle_number(8)", expected: "36", description: "8*9/2" },
      ],
    },
    {
      functionName: "are_coprime",
      prompt: "Ecrivez une fonction qui retourne 1 si a et b sont premiers entre eux, sinon 0.",
      params: ["a", "b"],
      tests: [
        { input: "are_coprime(14, 15)", expected: "1", description: "PGCD=1" },
        { input: "are_coprime(18, 24)", expected: "0", description: "PGCD=6" },
        { input: "are_coprime(35, 64)", expected: "1", description: "PGCD=1" },
      ],
    },
    {
      functionName: "product_digits",
      prompt: "Ecrivez une fonction qui retourne le produit des chiffres de n (en valeur absolue).",
      params: ["n"],
      tests: [
        { input: "product_digits(123)", expected: "6", description: "1*2*3" },
        { input: "product_digits(405)", expected: "0", description: "presence de 0" },
        { input: "product_digits(-37)", expected: "21", description: "3*7" },
      ],
    },
  ],
  HARD: [
    {
      functionName: "euler_totient_small",
      prompt: "Ecrivez une fonction qui retourne phi(n): le nombre d'entiers dans [1..n] qui sont premiers avec n. Pour n<=0, retournez 0.",
      params: ["n"],
      tests: [
        { input: "euler_totient_small(1)", expected: "1", description: "phi(1)=1" },
        { input: "euler_totient_small(9)", expected: "6", description: "1,2,4,5,7,8" },
        { input: "euler_totient_small(10)", expected: "4", description: "1,3,7,9" },
      ],
    },
    {
      functionName: "count_primes_up_to",
      prompt: "Ecrivez une fonction qui retourne le nombre de nombres premiers <= n.",
      params: ["n"],
      tests: [
        { input: "count_primes_up_to(1)", expected: "0", description: "aucun premier" },
        { input: "count_primes_up_to(10)", expected: "4", description: "2,3,5,7" },
        { input: "count_primes_up_to(30)", expected: "10", description: "10 premiers <= 30" },
      ],
    },
    {
      functionName: "tribonacci_mod",
      prompt: "Ecrivez une fonction qui retourne Tn % mod pour la suite de Tribonacci (T0=0, T1=1, T2=1), avec mod > 0.",
      params: ["n", "mod"],
      tests: [
        { input: "tribonacci_mod(0, 7)", expected: "0", description: "T0" },
        { input: "tribonacci_mod(7, 5)", expected: "4", description: "T7=24, 24%5=4" },
        { input: "tribonacci_mod(8, 10)", expected: "4", description: "T8=44, 44%10=4" },
      ],
    },
    {
      functionName: "longest_run_ones_binary",
      prompt: "Ecrivez une fonction qui retourne la longueur maximale d'une suite consecutive de bits a 1 dans l'ecriture binaire de n (n >= 0).",
      params: ["n"],
      tests: [
        { input: "longest_run_ones_binary(0)", expected: "0", description: "0b0" },
        { input: "longest_run_ones_binary(29)", expected: "3", description: "11101b" },
        { input: "longest_run_ones_binary(62)", expected: "5", description: "111110b" },
      ],
    },
  ],
};

const CODE_SUPER_TASKS = {
  SIMPLE: [
    {
      functionName: "decrement_by_k",
      prompt: "Ecrivez une fonction qui retourne n diminue de k.",
      params: ["n", "k"],
      tests: [
        { input: "decrement_by_k(9, 4)", expected: "5", description: "9 - 4" },
        { input: "decrement_by_k(-2, 3)", expected: "-5", description: "-2 - 3" },
        { input: "decrement_by_k(0, 0)", expected: "0", description: "0 - 0" },
      ],
    },
    {
      functionName: "max_abs_two",
      prompt: "Ecrivez une fonction qui retourne la plus grande valeur absolue entre a et b.",
      params: ["a", "b"],
      tests: [
        { input: "max_abs_two(10, -4)", expected: "10", description: "max(|10|,| -4 |)" },
        { input: "max_abs_two(-3, 5)", expected: "5", description: "max(|-3|,|5|)" },
        { input: "max_abs_two(-7, -7)", expected: "7", description: "valeurs absolues egales" },
      ],
    },
    {
      functionName: "in_range_inclusive",
      prompt: "Ecrivez une fonction qui retourne 1 si x est dans l'intervalle [a, b], sinon 0.",
      params: ["x", "a", "b"],
      tests: [
        { input: "in_range_inclusive(5, 1, 10)", expected: "1", description: "5 dans [1,10]" },
        { input: "in_range_inclusive(1, 1, 10)", expected: "1", description: "borne incluse" },
        { input: "in_range_inclusive(11, 1, 10)", expected: "0", description: "hors intervalle" },
      ],
    },
    {
      functionName: "multiply_by_ten",
      prompt: "Ecrivez une fonction qui retourne n multiplie par 10.",
      params: ["n"],
      tests: [
        { input: "multiply_by_ten(3)", expected: "30", description: "3 * 10" },
        { input: "multiply_by_ten(-4)", expected: "-40", description: "-4 * 10" },
        { input: "multiply_by_ten(0)", expected: "0", description: "0 * 10" },
      ],
    },
    {
      functionName: "parity_code",
      prompt: "Ecrivez une fonction qui retourne 0 si n est pair, sinon 1.",
      params: ["n"],
      tests: [
        { input: "parity_code(8)", expected: "0", description: "8 pair" },
        { input: "parity_code(7)", expected: "1", description: "7 impair" },
        { input: "parity_code(0)", expected: "0", description: "0 pair" },
      ],
    },
    {
      functionName: "sign_code",
      prompt: "Ecrivez une fonction qui retourne -1 si n<0, 0 si n=0, et 1 si n>0.",
      params: ["n"],
      tests: [
        { input: "sign_code(-5)", expected: "-1", description: "negatif" },
        { input: "sign_code(0)", expected: "0", description: "zero" },
        { input: "sign_code(9)", expected: "1", description: "positif" },
      ],
    },
  ],
  MEDIUM: [
    {
      functionName: "nth_arithmetic_term",
      prompt: "Ecrivez une fonction qui retourne le n-ieme terme d'une suite arithmetique de premier terme a1 et de raison d (n>=1).",
      params: ["a1", "d", "n"],
      tests: [
        { input: "nth_arithmetic_term(2, 3, 1)", expected: "2", description: "premier terme" },
        { input: "nth_arithmetic_term(2, 3, 4)", expected: "11", description: "2,5,8,11" },
        { input: "nth_arithmetic_term(10, -2, 3)", expected: "6", description: "10,8,6" },
      ],
    },
    {
      functionName: "sum_multiples_up_to",
      prompt: "Ecrivez une fonction qui retourne la somme des multiples de m entre 1 et n inclus (m>0).",
      params: ["n", "m"],
      tests: [
        { input: "sum_multiples_up_to(10, 3)", expected: "18", description: "3+6+9" },
        { input: "sum_multiples_up_to(20, 5)", expected: "50", description: "5+10+15+20" },
        { input: "sum_multiples_up_to(4, 7)", expected: "0", description: "aucun multiple" },
      ],
    },
    {
      functionName: "is_perfect_square_int",
      prompt: "Ecrivez une fonction qui retourne 1 si n est un carre parfait, sinon 0.",
      params: ["n"],
      tests: [
        { input: "is_perfect_square_int(16)", expected: "1", description: "4^2" },
        { input: "is_perfect_square_int(18)", expected: "0", description: "pas un carre parfait" },
        { input: "is_perfect_square_int(0)", expected: "1", description: "0^2" },
      ],
    },
    {
      functionName: "count_digits_equal_to",
      prompt: "Ecrivez une fonction qui compte combien de chiffres de n (en valeur absolue) sont egaux a d.",
      params: ["n", "d"],
      tests: [
        { input: "count_digits_equal_to(122333, 3)", expected: "3", description: "trois 3" },
        { input: "count_digits_equal_to(1001, 0)", expected: "2", description: "deux 0" },
        { input: "count_digits_equal_to(456, 9)", expected: "0", description: "aucun 9" },
      ],
    },
    {
      functionName: "alternating_sum_to_n",
      prompt: "Ecrivez une fonction qui retourne 1-2+3-4+...+(-1)^(n+1)*n pour n>=1.",
      params: ["n"],
      tests: [
        { input: "alternating_sum_to_n(1)", expected: "1", description: "1" },
        { input: "alternating_sum_to_n(4)", expected: "-2", description: "1-2+3-4" },
        { input: "alternating_sum_to_n(5)", expected: "3", description: "1-2+3-4+5" },
      ],
    },
    {
      functionName: "sum_squares_to_n",
      prompt: "Ecrivez une fonction qui retourne 1^2 + 2^2 + ... + n^2 pour n>=0.",
      params: ["n"],
      tests: [
        { input: "sum_squares_to_n(0)", expected: "0", description: "n=0" },
        { input: "sum_squares_to_n(3)", expected: "14", description: "1+4+9" },
        { input: "sum_squares_to_n(5)", expected: "55", description: "1+4+9+16+25" },
      ],
    },
  ],
  HARD: [
    {
      functionName: "next_power_of_two_ge",
      prompt: "Ecrivez une fonction qui retourne la plus petite puissance de 2 superieure ou egale a n. Si n<=1, retournez 1.",
      params: ["n"],
      tests: [
        { input: "next_power_of_two_ge(1)", expected: "1", description: "cas de base" },
        { input: "next_power_of_two_ge(13)", expected: "16", description: "puissance suivante" },
        { input: "next_power_of_two_ge(32)", expected: "32", description: "deja puissance de 2" },
      ],
    },
    {
      functionName: "euclid_steps",
      prompt: "Ecrivez une fonction qui retourne le nombre d'iterations de l'algorithme d'Euclide pour calculer le PGCD de a et b (a,b>=0).",
      params: ["a", "b"],
      tests: [
        { input: "euclid_steps(10, 4)", expected: "2", description: "10%4 puis 4%2" },
        { input: "euclid_steps(12, 18)", expected: "3", description: "12,18 -> 18,12 -> 12,6 -> 6,0" },
        { input: "euclid_steps(7, 0)", expected: "0", description: "deja termine" },
      ],
    },
    {
      functionName: "is_happy_number",
      prompt: "Ecrivez une fonction qui retourne 1 si n est un nombre heureux, sinon 0.",
      params: ["n"],
      tests: [
        { input: "is_happy_number(19)", expected: "1", description: "19 est heureux" },
        { input: "is_happy_number(2)", expected: "0", description: "2 n'est pas heureux" },
        { input: "is_happy_number(1)", expected: "1", description: "1 est heureux" },
      ],
    },
    {
      functionName: "gray_code",
      prompt: "Ecrivez une fonction qui retourne le code de Gray de n (n XOR (n >> 1)).",
      params: ["n"],
      tests: [
        { input: "gray_code(0)", expected: "0", description: "gray(0)" },
        { input: "gray_code(5)", expected: "7", description: "5 xor 2 = 7" },
        { input: "gray_code(10)", expected: "15", description: "10 xor 5 = 15" },
      ],
    },
    {
      functionName: "sum_first_n_primes",
      prompt: "Ecrivez une fonction qui retourne la somme des n premiers nombres premiers (n>=0).",
      params: ["n"],
      tests: [
        { input: "sum_first_n_primes(0)", expected: "0", description: "aucun premier" },
        { input: "sum_first_n_primes(3)", expected: "10", description: "2+3+5" },
        { input: "sum_first_n_primes(5)", expected: "28", description: "2+3+5+7+11" },
      ],
    },
    {
      functionName: "collatz_peak",
      prompt: "Ecrivez une fonction qui retourne la valeur maximale atteinte pendant la suite de Collatz a partir de n jusqu'a 1 (n>=1).",
      params: ["n"],
      tests: [
        { input: "collatz_peak(1)", expected: "1", description: "suite triviale" },
        { input: "collatz_peak(6)", expected: "16", description: "pic a 16" },
        { input: "collatz_peak(3)", expected: "16", description: "3->10->5->16..." },
      ],
    },
  ],
};

function rotateChoices(correct, wrongs, seed) {
  const uniqueWrongs = [];
  const seen = new Set([correct]);
  for (const item of wrongs) {
    if (typeof item !== "string") continue;
    if (seen.has(item)) continue;
    seen.add(item);
    uniqueWrongs.push(item);
    if (uniqueWrongs.length === 3) break;
  }

  while (uniqueWrongs.length < 3) {
    uniqueWrongs.push(`Option ${uniqueWrongs.length + 2}`);
  }

  const raw = [correct, ...uniqueWrongs.slice(0, 3)];
  const shift = seed % 4;
  const choices = raw.slice(shift).concat(raw.slice(0, shift));
  return {
    choices,
    correctChoiceIndex: choices.indexOf(correct),
  };
}

function buildStarterCode(language, functionName, params) {
  if (language === "python") {
    return [
      `def ${functionName}(${params.join(", ")}):`,
      "    # Votre code ici",
      "    pass",
    ].join("\n");
  }

  const typedParams = params.map((name) => `int ${name}`).join(", ");

  if (language === "java") {
    return [
      "public class Solution {",
      `    public static int ${functionName}(${typedParams}) {`,
      "        // Votre code ici",
      "        return 0;",
      "    }",
      "}",
    ].join("\n");
  }

  return [
    `int ${functionName}(${typedParams}) {`,
    "    // Votre code ici",
    "    return 0;",
    "}",
  ].join("\n");
}

function normalizePrompt(text) {
  return String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function safeReadJSON(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLegacyQuestions(language, difficulty) {
  const primaryPath = path.join(QUESTIONS_DIR, `${language}_${difficulty}.json`);
  return safeReadJSON(primaryPath);
}

function isFlashQuestion(question) {
  return (
    question &&
    question.type === "FLASH" &&
    Array.isArray(question.choices) &&
    question.choices.length === 4 &&
    Number.isInteger(question.correctChoiceIndex) &&
    question.correctChoiceIndex >= 0 &&
    question.correctChoiceIndex < 4 &&
    typeof question.prompt === "string" &&
    question.prompt.trim().length > 0
  );
}

function isCodeQuestion(question) {
  return (
    question &&
    question.type === "CODE" &&
    typeof question.starterCode === "string" &&
    question.starterCode.trim().length > 0 &&
    Array.isArray(question.tests) &&
    question.tests.length >= 3 &&
    question.tests.every(
      (test) =>
        test &&
        typeof test.input === "string" &&
        typeof test.expected === "string" &&
        typeof test.description === "string"
    ) &&
    typeof question.prompt === "string" &&
    question.prompt.trim().length > 0
  );
}

function buildFlashGenerated(language, difficultyUpper) {
  const profile = LANGUAGE_PROFILE[language];
  const factories = [
    ...(FLASH_TEMPLATES[difficultyUpper] || []),
    ...(FLASH_EXTRA_TEMPLATES[difficultyUpper] || []),
    ...(FLASH_BONUS_TEMPLATES[difficultyUpper] || []),
    ...(FLASH_SUPER_TEMPLATES[difficultyUpper] || []),
  ];

  return factories.map((factory, idx) => {
    const spec = factory(profile);
    const mcq = rotateChoices(spec.correct, spec.wrongs, idx + language.length);
    return {
      id: `${language}_${difficultyUpper.toLowerCase()}_flash_gen_${String(idx + 1).padStart(2, "0")}`,
      type: "FLASH",
      language,
      prompt: spec.prompt,
      difficulty: difficultyUpper,
      pointsBase: POINTS[difficultyUpper].FLASH,
      choices: mcq.choices,
      correctChoiceIndex: mcq.correctChoiceIndex,
    };
  });
}

function buildCodeGenerated(language, difficultyUpper) {
  const tasks = [
    ...(CODE_TASKS[difficultyUpper] || []),
    ...(CODE_EXTRA_TASKS[difficultyUpper] || []),
    ...(CODE_BONUS_TASKS[difficultyUpper] || []),
    ...(CODE_SUPER_TASKS[difficultyUpper] || []),
  ];

  return tasks.map((task, idx) => ({
    id: `${language}_${difficultyUpper.toLowerCase()}_code_gen_${String(idx + 1).padStart(2, "0")}`,
    type: "CODE",
    language,
    prompt: `${task.prompt} La fonction doit s'appeler ${task.functionName}.`,
    difficulty: difficultyUpper,
    pointsBase: POINTS[difficultyUpper].CODE,
    starterCode: buildStarterCode(language, task.functionName, task.params),
    maxLines: Number.isInteger(task.maxLines) && task.maxLines > 0
      ? task.maxLines
      : MAX_LINES_BY_DIFFICULTY[difficultyUpper],
    tests: task.tests,
  }));
}

function resolveMaxLines(question, difficultyUpper) {
  if (Number.isInteger(question?.maxLines) && question.maxLines > 0) {
    return question.maxLines;
  }
  return MAX_LINES_BY_DIFFICULTY[difficultyUpper];
}

function pickQuestions({ legacy, generated, expectedCount, type, language, difficultyUpper }) {
  const seenPrompts = new Set();
  const selected = [];

  for (const source of [legacy, generated]) {
    for (const question of source) {
      const normalized = normalizePrompt(question.prompt);
      if (!normalized || seenPrompts.has(normalized)) continue;

      const isValid = type === "FLASH" ? isFlashQuestion(question) : isCodeQuestion(question);
      if (!isValid) continue;

      seenPrompts.add(normalized);
      selected.push({
        ...question,
        type,
        language,
        difficulty: difficultyUpper,
        pointsBase: POINTS[difficultyUpper][type],
        ...(type === "CODE" ? { maxLines: resolveMaxLines(question, difficultyUpper) } : {}),
      });

      if (selected.length === expectedCount) {
        return selected.map((q, index) => ({
          ...q,
          id: `${language}_${difficultyUpper.toLowerCase()}_${type.toLowerCase()}_${String(index + 1).padStart(2, "0")}`,
        }));
      }
    }
  }

  throw new Error(
    `Impossible de produire ${expectedCount} questions ${type} pour ${language} ${difficultyUpper} (obtenu ${selected.length})`
  );
}

function writeQuestionFile(language, difficulty, type, questions) {
  const fileName = `${language}_${difficulty}_${type}.json`;
  const filePath = path.join(QUESTIONS_DIR, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(questions, null, 2)}\n`, "utf-8");
  return fileName;
}

function buildBank() {
  const writtenFiles = [];

  LANGUAGES.forEach((language) => {
    DIFFICULTIES.forEach((difficulty) => {
      const difficultyUpper = difficulty.toUpperCase();
      const legacyQuestions = readLegacyQuestions(language, difficulty).map((question) => ({
        ...question,
        type: String(question.type || "").toUpperCase(),
      }));

      const legacyFlash = legacyQuestions.filter((q) => q.type === "FLASH");
      const legacyCode = legacyQuestions.filter((q) => q.type === "CODE");

      const generatedFlash = buildFlashGenerated(language, difficultyUpper);
      const generatedCode = buildCodeGenerated(language, difficultyUpper);

      const flashQuestions = pickQuestions({
        legacy: legacyFlash,
        generated: generatedFlash,
        expectedCount: QUESTIONS_PER_BUCKET,
        type: "FLASH",
        language,
        difficultyUpper,
      });

      const codeQuestions = pickQuestions({
        legacy: legacyCode,
        generated: generatedCode,
        expectedCount: QUESTIONS_PER_BUCKET,
        type: "CODE",
        language,
        difficultyUpper,
      });

      writtenFiles.push(writeQuestionFile(language, difficulty, "flash", flashQuestions));
      writtenFiles.push(writeQuestionFile(language, difficulty, "code", codeQuestions));
    });
  });

  return writtenFiles;
}

const files = buildBank();
console.log(`Banque regeneree: ${files.length} fichiers ecrits.`);
for (const file of files) {
  console.log(` - ${file}`);
}
