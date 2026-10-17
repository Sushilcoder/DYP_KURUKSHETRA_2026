export type Language = 'python' | 'java';

export type BankSnippet = {
  id: string;
  keywords: string[];
  title: string;
  bullets: string[];
  code: string;
  output: string;
  explain: string;
  cheat: string;
  quiz: { question: string; options: string[]; correctIndex: number; explanation: string };
};

export type BankExercise = {
  id: string;
  keywords: string[];
  title: string;
  prompt: string;
  solution: string;
  tests: { description: string; input: string; expectedOutput: string }[];
};

const py = (lines: string[]) => lines.join('\n');

export const PYTHON_SNIPPETS: BankSnippet[] = [
  {
    id: 'py-listcomp',
    keywords: ['list', 'comprehension', 'comprehensions', 'collections', 'loop', 'iteration'],
    title: 'Building lists with comprehensions',
    bullets: ['A comprehension builds a new list in one expression', 'Pattern: [expression for item in iterable]', 'Reads left to right: what you want, then where it comes from'],
    code: py(['squares = [n * n for n in range(1, 6)]', 'print(squares)']),
    output: '[1, 4, 9, 16, 25]',
    explain: 'The comprehension squares every number from 1 to 5 and collects the results in order.',
    cheat: '[expr for x in items] builds a new list from any iterable',
    quiz: { question: 'What does [n * n for n in range(1, 4)] produce?', options: ['[1, 4, 9]', '[0, 1, 4]', '[1, 2, 3]', '[2, 4, 6]'], correctIndex: 0, explanation: 'range(1, 4) yields 1, 2, 3 and each value is squared.' },
  },
  {
    id: 'py-filter',
    keywords: ['list', 'comprehension', 'comprehensions', 'filter', 'condition', 'string', 'strings'],
    title: 'Filtering while you transform',
    bullets: ['Add an if clause to keep only matching items', 'Transform and filter in a single pass', 'Keep conditions short so the line stays readable'],
    code: py(['words = ["apple", "kiwi", "banana", "fig"]', 'short = [w.upper() for w in words if len(w) <= 4]', 'print(short)']),
    output: "['KIWI', 'FIG']",
    explain: 'Only words of four letters or fewer pass the filter, and each survivor is upper-cased.',
    cheat: '[f(x) for x in items if cond(x)] filters and maps in one step',
    quiz: { question: 'Where does the filtering if go in a list comprehension?', options: ['After the for clause', 'Before the expression', 'Inside range()', 'It is not allowed'], correctIndex: 0, explanation: 'The syntax is [expr for x in items if condition].' },
  },
  {
    id: 'py-dictcomp',
    keywords: ['dict', 'dictionary', 'dictionaries', 'comprehension', 'map', 'mapping', 'collections'],
    title: 'Dictionary comprehensions',
    bullets: ['Use {key: value for ...} to build a dict', 'Great for re-keying or transforming values', '.items() gives key/value pairs to unpack'],
    code: py(['prices = {"tea": 20, "coffee": 30, "juice": 45}', 'doubled = {name: cost * 2 for name, cost in prices.items()}', 'print(doubled)']),
    output: "{'tea': 40, 'coffee': 60, 'juice': 90}",
    explain: 'Each key keeps its name while its value is doubled, preserving insertion order.',
    cheat: '{k: v for k, v in d.items()} rebuilds a dictionary',
    quiz: { question: 'Which method yields key/value pairs from a dict?', options: ['.items()', '.keys()', '.values()', '.pairs()'], correctIndex: 0, explanation: '.items() returns (key, value) tuples that can be unpacked.' },
  },
  {
    id: 'py-functions',
    keywords: ['function', 'functions', 'def', 'parameter', 'parameters', 'argument', 'arguments', 'basics'],
    title: 'Functions with default arguments',
    bullets: ['def names a reusable block of logic', 'Default values make parameters optional', 'return sends a value back to the caller'],
    code: py(['def greet(name, greeting="Hello"):', '    return f"{greeting}, {name}!"', '', 'print(greet("Asha"))', 'print(greet("Ravi", "Welcome"))']),
    output: 'Hello, Asha!\nWelcome, Ravi!',
    explain: 'The first call uses the default greeting, while the second overrides it with a positional argument.',
    cheat: 'def f(a, b=1): defaults must come after required parameters',
    quiz: { question: 'What does greet("Ravi", "Hi") return?', options: ['Hi, Ravi!', 'Hello, Ravi!', 'Ravi, Hi!', 'An error'], correctIndex: 0, explanation: 'The second positional argument replaces the default greeting.' },
  },
  {
    id: 'py-recursion',
    keywords: ['recursion', 'recursive', 'function', 'functions', 'factorial', 'algorithm', 'algorithms'],
    title: 'Thinking recursively',
    bullets: ['A recursive function calls itself on a smaller input', 'Every recursion needs a base case', 'Each call waits for the smaller call to finish'],
    code: py(['def factorial(n):', '    if n <= 1:', '        return 1', '    return n * factorial(n - 1)', '', 'print(factorial(5))']),
    output: '120',
    explain: 'factorial(5) unwinds into 5 * 4 * 3 * 2 * 1, stopping at the base case n <= 1.',
    cheat: 'Recursion = base case + call on a smaller problem',
    quiz: { question: 'What stops a recursive function from running forever?', options: ['A base case', 'A global variable', 'A while loop', 'The return type'], correctIndex: 0, explanation: 'The base case returns without making another recursive call.' },
  },
  {
    id: 'py-classes',
    keywords: ['class', 'classes', 'object', 'objects', 'oop', 'dataclass', 'inheritance'],
    title: 'Modelling data with classes',
    bullets: ['A class bundles data and behaviour', '@dataclass writes __init__ and __repr__ for you', 'Methods receive the instance as self'],
    code: py(['from dataclasses import dataclass', '', '@dataclass', 'class Course:', '    title: str', '    hours: int', '', '    def summary(self):', '        return f"{self.title} ({self.hours}h)"', '', 'print(Course("Python Basics", 6).summary())']),
    output: 'Python Basics (6h)',
    explain: 'The dataclass generates the constructor, and summary formats the stored fields.',
    cheat: '@dataclass auto-generates __init__, __repr__ and __eq__',
    quiz: { question: 'What does @dataclass generate automatically?', options: ['__init__ and __repr__', 'A database table', 'Unit tests', 'A main function'], correctIndex: 0, explanation: 'Dataclasses generate common dunder methods from annotated fields.' },
  },
  {
    id: 'py-exceptions',
    keywords: ['exception', 'exceptions', 'error', 'errors', 'try', 'handling', 'validation'],
    title: 'Handling errors safely',
    bullets: ['Wrap risky code in try', 'Catch the specific exception you expect', 'Return a safe fallback instead of crashing'],
    code: py(['def to_int(text):', '    try:', '        return int(text)', '    except ValueError:', '        return 0', '', 'print(to_int("42"), to_int("abc"))']),
    output: '42 0',
    explain: 'Valid digits convert normally, while invalid text raises ValueError and falls back to 0.',
    cheat: 'try / except SpecificError keeps failures explicit',
    quiz: { question: 'Which exception does int("abc") raise?', options: ['ValueError', 'TypeError', 'KeyError', 'IndexError'], correctIndex: 0, explanation: 'The type is right (str) but the value cannot be parsed.' },
  },
  {
    id: 'py-enumerate',
    keywords: ['loop', 'loops', 'for', 'iteration', 'enumerate', 'basics', 'list'],
    title: 'Looping with enumerate',
    bullets: ['enumerate yields index and value together', 'start= changes the first index', 'Avoids manual counter variables'],
    code: py(['topics = ["Variables", "Loops", "Functions"]', 'for number, topic in enumerate(topics, start=1):', '    print(f"{number}. {topic}")']),
    output: '1. Variables\n2. Loops\n3. Functions',
    explain: 'enumerate pairs each topic with a counter that starts at 1.',
    cheat: 'for i, x in enumerate(items, start=1): numbered loops',
    quiz: { question: 'What does enumerate(["a", "b"]) yield first?', options: ['(0, "a")', '(1, "a")', '"a"', '0'], correctIndex: 0, explanation: 'enumerate starts at 0 unless start= is given.' },
  },
  {
    id: 'py-sorting',
    keywords: ['sort', 'sorting', 'lambda', 'key', 'algorithm', 'algorithms', 'list'],
    title: 'Sorting with a key function',
    bullets: ['sorted() returns a new sorted list', 'key= decides what to compare', 'reverse=True flips the order'],
    code: py(['scores = [("Asha", 82), ("Ravi", 95), ("Meera", 78)]', 'ranked = sorted(scores, key=lambda pair: pair[1], reverse=True)', 'print([name for name, _ in ranked])']),
    output: "['Ravi', 'Asha', 'Meera']",
    explain: 'The lambda sorts by score, highest first, and the comprehension keeps only names.',
    cheat: 'sorted(items, key=lambda x: x[1], reverse=True)',
    quiz: { question: 'What does sorted() return?', options: ['A new list', 'None', 'The same list mutated', 'A tuple'], correctIndex: 0, explanation: 'sorted() never mutates; list.sort() does.' },
  },
  {
    id: 'py-generators',
    keywords: ['generator', 'generators', 'yield', 'iterator', 'iteration', 'memory', 'comprehension'],
    title: 'Generator expressions',
    bullets: ['Parentheses create a lazy generator', 'Values are produced one at a time', 'Ideal inside sum(), max() or any()'],
    code: py(['total = sum(n * n for n in range(1, 11) if n % 2 == 0)', 'print(total)']),
    output: '220',
    explain: 'Even numbers 2 to 10 are squared lazily and summed: 4 + 16 + 36 + 64 + 100.',
    cheat: 'sum(x for x in items) streams values without building a list',
    quiz: { question: 'Why use a generator expression inside sum()?', options: ['It avoids building a temporary list', 'It sorts the values', 'It runs in parallel', 'It caches results'], correctIndex: 0, explanation: 'Generators yield values lazily, saving memory.' },
  },
];

const java = (lines: string[]) => lines.join('\n');

export const JAVA_SNIPPETS: BankSnippet[] = [
  {
    id: 'java-arrays',
    keywords: ['array', 'arrays', 'loop', 'loops', 'for', 'basics', 'iteration'],
    title: 'Looping over arrays',
    bullets: ['Arrays hold a fixed number of values', 'The enhanced for loop reads each element', 'Accumulate results in a local variable'],
    code: java(['public class Main {', '    public static void main(String[] args) {', '        int[] marks = {72, 85, 91};', '        int total = 0;', '        for (int mark : marks) {', '            total += mark;', '        }', '        System.out.println("Total: " + total);', '    }', '}']),
    output: 'Total: 248',
    explain: 'The enhanced for loop visits each mark once and adds it to the running total.',
    cheat: 'for (int x : array) { ... } iterates without an index',
    quiz: { question: 'What does an enhanced for loop give you each iteration?', options: ['The next element', 'The index', 'The array length', 'A copy of the array'], correctIndex: 0, explanation: 'for (T x : items) binds x to each element in turn.' },
  },
  {
    id: 'java-methods',
    keywords: ['method', 'methods', 'function', 'functions', 'static', 'parameter', 'basics'],
    title: 'Static methods and parameters',
    bullets: ['Methods package reusable logic', 'Parameters are typed', 'The return type is declared before the name'],
    code: java(['public class Main {', '    static String greet(String name) {', '        return "Hello, " + name + "!";', '    }', '', '    public static void main(String[] args) {', '        System.out.println(greet("Asha"));', '    }', '}']),
    output: 'Hello, Asha!',
    explain: 'greet builds a string from its parameter and main prints the returned value.',
    cheat: 'static ReturnType name(Type param) { return value; }',
    quiz: { question: 'Where is a Java method return type declared?', options: ['Before the method name', 'After the parameters', 'Inside the body', 'It is inferred'], correctIndex: 0, explanation: 'Signatures read: modifiers, return type, name, parameters.' },
  },
  {
    id: 'java-lists',
    keywords: ['list', 'lists', 'arraylist', 'collection', 'collections', 'generics'],
    title: 'Working with ArrayList',
    bullets: ['ArrayList grows as you add items', 'Generics keep the list type-safe', 'size() reports the element count'],
    code: java(['import java.util.ArrayList;', 'import java.util.List;', '', 'public class Main {', '    public static void main(String[] args) {', '        List<String> topics = new ArrayList<>();', '        topics.add("Classes");', '        topics.add("Streams");', '        System.out.println(topics + " size=" + topics.size());', '    }', '}']),
    output: '[Classes, Streams] size=2',
    explain: 'The list grows with each add call, and printing it uses the built-in toString.',
    cheat: 'List<T> list = new ArrayList<>(); list.add(x); list.size()',
    quiz: { question: 'What does List<String> guarantee?', options: ['Only Strings can be added', 'The list is sorted', 'The list is immutable', 'No duplicates'], correctIndex: 0, explanation: 'Generics restrict the element type at compile time.' },
  },
  {
    id: 'java-streams',
    keywords: ['stream', 'streams', 'lambda', 'lambdas', 'functional', 'filter', 'map', 'collection', 'collections'],
    title: 'Filtering and mapping with streams',
    bullets: ['Streams describe a pipeline of operations', 'filter keeps matches, map transforms', 'toList() collects the result'],
    code: java(['import java.util.List;', '', 'public class Main {', '    public static void main(String[] args) {', '        List<Integer> evens = List.of(1, 2, 3, 4, 5, 6).stream()', '            .filter(n -> n % 2 == 0)', '            .map(n -> n * n)', '            .toList();', '        System.out.println(evens);', '    }', '}']),
    output: '[4, 16, 36]',
    explain: 'Only even numbers pass the filter, and each is squared before collecting.',
    cheat: 'list.stream().filter(...).map(...).toList()',
    quiz: { question: 'Which stream operation transforms each element?', options: ['map', 'filter', 'count', 'distinct'], correctIndex: 0, explanation: 'map applies a function to every element.' },
  },
  {
    id: 'java-records',
    keywords: ['class', 'classes', 'object', 'objects', 'oop', 'record', 'records', 'constructor'],
    title: 'Modelling data with records',
    bullets: ['A record is a compact, immutable data class', 'Accessors are generated automatically', 'Ideal for value objects and DTOs'],
    code: java(['public class Main {', '    record Course(String title, int hours) {', '        String summary() {', '            return title + " (" + hours + "h)";', '        }', '    }', '', '    public static void main(String[] args) {', '        System.out.println(new Course("Java Basics", 8).summary());', '    }', '}']),
    output: 'Java Basics (8h)',
    explain: 'The record stores both fields and the summary method reads them directly.',
    cheat: 'record Name(Type a, Type b) {} gives constructor, accessors, equals',
    quiz: { question: 'What does a Java record provide automatically?', options: ['Constructor and accessors', 'A database table', 'Setters for every field', 'A main method'], correctIndex: 0, explanation: 'Records are immutable, so they generate accessors but no setters.' },
  },
  {
    id: 'java-exceptions',
    keywords: ['exception', 'exceptions', 'error', 'errors', 'try', 'catch', 'handling', 'validation'],
    title: 'Catching exceptions',
    bullets: ['try wraps code that might fail', 'catch handles a specific exception type', 'Return a safe fallback value'],
    code: java(['public class Main {', '    static int toInt(String text) {', '        try {', '            return Integer.parseInt(text);', '        } catch (NumberFormatException e) {', '            return 0;', '        }', '    }', '', '    public static void main(String[] args) {', '        System.out.println(toInt("42") + " " + toInt("abc"));', '    }', '}']),
    output: '42 0',
    explain: 'Valid digits parse normally while invalid text triggers the fallback branch.',
    cheat: 'try { ... } catch (SpecificException e) { ... }',
    quiz: { question: 'Which exception does Integer.parseInt("abc") throw?', options: ['NumberFormatException', 'NullPointerException', 'IOException', 'ClassCastException'], correctIndex: 0, explanation: 'The string cannot be parsed as an integer.' },
  },
  {
    id: 'java-maps',
    keywords: ['map', 'maps', 'hashmap', 'treemap', 'dictionary', 'collection', 'collections'],
    title: 'Counting with a Map',
    bullets: ['Maps associate keys with values', 'merge() updates or inserts in one call', 'TreeMap keeps keys sorted'],
    code: java(['import java.util.Map;', 'import java.util.TreeMap;', '', 'public class Main {', '    public static void main(String[] args) {', '        Map<String, Integer> counts = new TreeMap<>();', '        for (String word : "red blue red green".split(" ")) {', '            counts.merge(word, 1, Integer::sum);', '        }', '        System.out.println(counts);', '    }', '}']),
    output: '{blue=1, green=1, red=2}',
    explain: 'merge inserts 1 for new words and adds 1 for repeats, while TreeMap sorts the keys.',
    cheat: 'map.merge(key, 1, Integer::sum) counts occurrences',
    quiz: { question: 'Which Map implementation keeps keys sorted?', options: ['TreeMap', 'HashMap', 'LinkedList', 'ArrayList'], correctIndex: 0, explanation: 'TreeMap orders keys by their natural ordering.' },
  },
  {
    id: 'java-strings',
    keywords: ['string', 'strings', 'stringbuilder', 'text', 'basics'],
    title: 'Building strings efficiently',
    bullets: ['Strings are immutable in Java', 'StringBuilder mutates a buffer instead', 'reverse() and append() are chainable'],
    code: java(['public class Main {', '    public static void main(String[] args) {', '        String word = "stream";', '        String reversed = new StringBuilder(word).reverse().toString();', '        System.out.println(word + " -> " + reversed);', '    }', '}']),
    output: 'stream -> maerts',
    explain: 'StringBuilder reverses the characters in place and toString returns a new String.',
    cheat: 'new StringBuilder(s).reverse().toString()',
    quiz: { question: 'Why use StringBuilder in loops?', options: ['It avoids creating many String objects', 'It is thread-safe', 'It sorts characters', 'It compresses text'], correctIndex: 0, explanation: 'String concatenation in loops creates many temporary objects.' },
  },
];

export const PYTHON_EXERCISES: BankExercise[] = [
  {
    id: 'pyex-even-squares',
    keywords: ['list', 'comprehension', 'comprehensions', 'filter', 'loop', 'collections'],
    title: 'Even squares',
    prompt: 'Write even_squares(nums) that returns the squares of the even numbers in nums, keeping their order.',
    solution: py(['def even_squares(nums):', '    return [n * n for n in nums if n % 2 == 0]']),
    tests: [
      { description: 'Mixed values', input: 'even_squares([1, 2, 3, 4])', expectedOutput: '[4, 16]' },
      { description: 'No evens', input: 'even_squares([1, 3, 5])', expectedOutput: '[]' },
      { description: 'Negatives', input: 'even_squares([-2, 0])', expectedOutput: '[4, 0]' },
    ],
  },
  {
    id: 'pyex-vowels',
    keywords: ['string', 'strings', 'loop', 'basics', 'function', 'functions', 'generator'],
    title: 'Count the vowels',
    prompt: 'Write count_vowels(text) that returns how many vowels (a, e, i, o, u) appear in text, ignoring case.',
    solution: py(['def count_vowels(text):', '    return sum(1 for ch in text.lower() if ch in "aeiou")']),
    tests: [
      { description: 'Simple word', input: 'count_vowels("Python")', expectedOutput: '1' },
      { description: 'Mixed case', input: 'count_vowels("EDUCATION")', expectedOutput: '5' },
      { description: 'Empty string', input: 'count_vowels("")', expectedOutput: '0' },
    ],
  },
  {
    id: 'pyex-word-lengths',
    keywords: ['dict', 'dictionary', 'comprehension', 'map', 'collections', 'string'],
    title: 'Word length map',
    prompt: 'Write word_lengths(words) that returns a dict mapping each word to its length.',
    solution: py(['def word_lengths(words):', '    return {word: len(word) for word in words}']),
    tests: [
      { description: 'Two words', input: 'word_lengths(["hi", "code"])', expectedOutput: "{'hi': 2, 'code': 4}" },
      { description: 'Empty list', input: 'word_lengths([])', expectedOutput: '{}' },
      { description: 'Single word', input: 'word_lengths(["python"])', expectedOutput: "{'python': 6}" },
    ],
  },
  {
    id: 'pyex-fib',
    keywords: ['recursion', 'recursive', 'function', 'functions', 'algorithm', 'algorithms', 'loop'],
    title: 'Fibonacci number',
    prompt: 'Write fib(n) that returns the n-th Fibonacci number where fib(0) is 0 and fib(1) is 1.',
    solution: py(['def fib(n):', '    a, b = 0, 1', '    for _ in range(n):', '        a, b = b, a + b', '    return a']),
    tests: [
      { description: 'Base case', input: 'fib(0)', expectedOutput: '0' },
      { description: 'Small value', input: 'fib(7)', expectedOutput: '13' },
      { description: 'Larger value', input: 'fib(10)', expectedOutput: '55' },
    ],
  },
  {
    id: 'pyex-safe-divide',
    keywords: ['exception', 'exceptions', 'error', 'errors', 'try', 'handling', 'class', 'oop'],
    title: 'Safe division',
    prompt: 'Write safe_divide(a, b) that returns a / b rounded to 2 places, or None when b is zero.',
    solution: py(['def safe_divide(a, b):', '    try:', '        return round(a / b, 2)', '    except ZeroDivisionError:', '        return None']),
    tests: [
      { description: 'Whole result', input: 'safe_divide(10, 4)', expectedOutput: '2.5' },
      { description: 'Divide by zero', input: 'safe_divide(1, 0)', expectedOutput: 'None' },
      { description: 'Rounded', input: 'safe_divide(1, 3)', expectedOutput: '0.33' },
    ],
  },
];

export const JAVA_EXERCISES: BankExercise[] = [
  {
    id: 'javaex-sum-evens',
    keywords: ['array', 'arrays', 'loop', 'loops', 'stream', 'streams', 'basics'],
    title: 'Sum of evens',
    prompt: 'Write Solution.sumOfEvens(int[] nums) that returns the sum of the even numbers in nums.',
    solution: java(['public class Solution {', '    public static int sumOfEvens(int[] nums) {', '        int total = 0;', '        for (int n : nums) {', '            if (n % 2 == 0) {', '                total += n;', '            }', '        }', '        return total;', '    }', '}']),
    tests: [
      { description: 'Mixed values', input: 'Solution.sumOfEvens(new int[]{1, 2, 3, 4})', expectedOutput: '6' },
      { description: 'No evens', input: 'Solution.sumOfEvens(new int[]{1, 3})', expectedOutput: '0' },
      { description: 'Negatives', input: 'Solution.sumOfEvens(new int[]{-2, 8})', expectedOutput: '6' },
    ],
  },
  {
    id: 'javaex-palindrome',
    keywords: ['string', 'strings', 'stringbuilder', 'text', 'method', 'methods'],
    title: 'Palindrome check',
    prompt: 'Write Solution.isPalindrome(String text) that returns true when text reads the same backwards, ignoring case.',
    solution: java(['public class Solution {', '    public static boolean isPalindrome(String text) {', '        String lower = text.toLowerCase();', '        return new StringBuilder(lower).reverse().toString().equals(lower);', '    }', '}']),
    tests: [
      { description: 'Palindrome', input: 'Solution.isPalindrome("Level")', expectedOutput: 'true' },
      { description: 'Not a palindrome', input: 'Solution.isPalindrome("Java")', expectedOutput: 'false' },
      { description: 'Empty', input: 'Solution.isPalindrome("")', expectedOutput: 'true' },
    ],
  },
  {
    id: 'javaex-factorial',
    keywords: ['recursion', 'recursive', 'method', 'methods', 'algorithm', 'algorithms', 'loop'],
    title: 'Factorial',
    prompt: 'Write Solution.factorial(int n) that returns n! as a long, where 0! is 1.',
    solution: java(['public class Solution {', '    public static long factorial(int n) {', '        long result = 1;', '        for (int i = 2; i <= n; i++) {', '            result *= i;', '        }', '        return result;', '    }', '}']),
    tests: [
      { description: 'Zero', input: 'Solution.factorial(0)', expectedOutput: '1' },
      { description: 'Five', input: 'Solution.factorial(5)', expectedOutput: '120' },
      { description: 'Ten', input: 'Solution.factorial(10)', expectedOutput: '3628800' },
    ],
  },
  {
    id: 'javaex-count-word',
    keywords: ['map', 'maps', 'collection', 'collections', 'list', 'string', 'class', 'oop', 'exception'],
    title: 'Count a word',
    prompt: 'Write Solution.countWord(String text, String word) that returns how many space-separated tokens equal word.',
    solution: java(['public class Solution {', '    public static int countWord(String text, String word) {', '        int count = 0;', '        for (String token : text.split(" ")) {', '            if (token.equals(word)) {', '                count++;', '            }', '        }', '        return count;', '    }', '}']),
    tests: [
      { description: 'Repeated word', input: 'Solution.countWord("red blue red", "red")', expectedOutput: '2' },
      { description: 'Missing word', input: 'Solution.countWord("red blue", "green")', expectedOutput: '0' },
      { description: 'Single token', input: 'Solution.countWord("java", "java")', expectedOutput: '1' },
    ],
  },
];

export function normalizeCode(code: string) {
  return code.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();
}

const FIXTURES = new Map<string, string>();
for (const s of [...PYTHON_SNIPPETS, ...JAVA_SNIPPETS]) FIXTURES.set(normalizeCode(s.code), s.output);

const EXERCISE_FIXTURES = new Map<string, BankExercise>();
for (const e of [...PYTHON_EXERCISES, ...JAVA_EXERCISES]) EXERCISE_FIXTURES.set(normalizeCode(e.solution), e);

export function findSnippetFixture(code: string) {
  return FIXTURES.get(normalizeCode(code));
}

export function findExerciseFixture(code: string) {
  return EXERCISE_FIXTURES.get(normalizeCode(code));
}
