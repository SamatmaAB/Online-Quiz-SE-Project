import Category from "../models/Category.js";
import Quiz from "../models/Quiz.js";
import User from "../models/User.js";
import { slugify } from "./questions.js";

const q = (prompt, options, correctOption) => ({ prompt, options, correctOption });

export const STARTER_QUIZZES = [
  { title: "SE Unit 1 · Foundations Check", category: "Software Engineering", subjectKey: "SE", unitIndex: 0, difficulty: "easy", durationMinutes: 8,
    description: "SDLC, Agile and requirements basics.",
    questions: [
      q("Which SDLC model is built around short, iterative cycles with continuous customer feedback?", ["Waterfall", "Agile", "V-model", "Big-bang"], 1),
      q("In Scrum, who is responsible for maximising the value of the product and managing the backlog?", ["Scrum Master", "Product Owner", "Developer", "Stakeholder"], 1),
      q("A requirement such as \"the system shall respond within 2 seconds\" is a…", ["Functional requirement", "Non-functional requirement", "Domain constraint", "User story"], 1),
      q("What is a Sprint in Scrum?", ["A bug-fixing session", "A time-boxed iteration that produces a usable increment", "A release to production", "A daily meeting"], 1),
      q("Which artefact lists everything that might be needed in the product, ordered by priority?", ["Sprint backlog", "Burndown chart", "Product backlog", "Test plan"], 2)
    ] },
  { title: "DBMS Unit 1 · SQL & ER Basics", category: "Database Systems", subjectKey: "DBMS", unitIndex: 0, difficulty: "easy", durationMinutes: 8,
    description: "Entities, keys and core SQL.",
    questions: [
      q("Which key uniquely identifies each row in a table?", ["Foreign key", "Primary key", "Candidate attribute", "Composite index"], 1),
      q("Which SQL clause filters rows after grouping?", ["WHERE", "HAVING", "ORDER BY", "LIMIT"], 1),
      q("In an E-R model, a weak entity…", ["Has no attributes", "Cannot be uniquely identified without its owner entity", "Never participates in relationships", "Always has a composite key of three attributes"], 1),
      q("Which JOIN returns all rows from the left table even if there is no match on the right?", ["INNER JOIN", "LEFT OUTER JOIN", "CROSS JOIN", "SELF JOIN"], 1),
      q("What does a foreign key enforce?", ["Uniqueness of a column", "Referential integrity between tables", "Sorted storage", "Column encryption"], 1)
    ] },
  { title: "ML Unit 1 · Metrics & Trees", category: "Machine Learning", subjectKey: "ML", unitIndex: 0, difficulty: "medium", durationMinutes: 10,
    description: "Accuracy, precision, recall, decision trees and KNN.",
    questions: [
      q("Precision is defined as…", ["TP / (TP + FN)", "TP / (TP + FP)", "TN / (TN + FP)", "(TP + TN) / total"], 1),
      q("Which metric is also called sensitivity?", ["Precision", "Recall", "Specificity", "Accuracy"], 1),
      q("A decision tree typically chooses a split by maximising…", ["Training time", "Information gain (or reducing impurity)", "Tree depth", "Number of leaves"], 1),
      q("In k-nearest neighbours, a very small k tends to cause…", ["Underfitting", "Overfitting", "Faster convergence", "Linear boundaries"], 1),
      q("The area under the ROC curve (AUC) of a random classifier is about…", ["0", "0.5", "0.75", "1"], 1)
    ] },
  { title: "UI/UX Unit 1 · Human Factors", category: "Design", subjectKey: "UIUX", unitIndex: 0, difficulty: "easy", durationMinutes: 8,
    description: "HCI, perception, cognition and memory.",
    questions: [
      q("HCI stands for…", ["High-Capacity Interface", "Human-Computer Interaction", "Hybrid Control Input", "Hyper Console Integration"], 1),
      q("Miller's law suggests short-term memory holds about how many items?", ["3 ± 1", "7 ± 2", "12 ± 3", "20 ± 5"], 1),
      q("Which Gestalt principle explains why we group items that are close together?", ["Proximity", "Closure", "Continuity", "Figure-ground"], 0),
      q("Recognition over recall in interface design aims to…", ["Reduce reliance on users' memory", "Hide menus", "Increase typing", "Add tutorials"], 0),
      q("Affordance refers to…", ["The cost of a feature", "Cues that suggest how an object can be used", "Colour contrast ratio", "Loading speed"], 1)
    ] },
  { title: "Kotlin Unit 1 · Language Basics", category: "Android & Kotlin", subjectKey: "KOTLIN", unitIndex: 0, difficulty: "easy", durationMinutes: 8,
    description: "Variables, null safety, functions and lambdas.",
    questions: [
      q("Which keyword declares a read-only variable in Kotlin?", ["var", "val", "const var", "let"], 1),
      q("How do you declare a nullable String in Kotlin?", ["String", "String?", "String!", "nullable String"], 1),
      q("What does the safe-call operator ?. do?", ["Throws if null", "Calls the member only if the receiver is not null", "Converts to non-null", "Compares references"], 1),
      q("What is the result type of `val x = 5 / 2` in Kotlin?", ["Double (2.5)", "Int (2)", "Float", "Long"], 1),
      q("A lambda in Kotlin is written inside…", ["Parentheses ()", "Curly braces {}", "Square brackets []", "Angle brackets <>"], 1)
    ] },
  { title: "General Knowledge Warm-up", category: "General Knowledge", subjectKey: null, unitIndex: null, difficulty: "easy", durationMinutes: 5,
    description: "A quick mixed round to try the quiz player.",
    questions: [
      q("What is the capital of Japan?", ["Seoul", "Tokyo", "Beijing", "Bangkok"], 1),
      q("How many continents are there?", ["5", "6", "7", "8"], 2),
      q("Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Mercury"], 1),
      q("What is H2O commonly called?", ["Salt", "Water", "Hydrogen", "Oxygen"], 1)
    ] }
];

export async function ensureSeedData() {
  let created = 0;
  for (const entry of STARTER_QUIZZES) {
    const slug = slugify(entry.category);
    const category = await Category.findOneAndUpdate(
      { slug },
      { $setOnInsert: { name: entry.category, slug } },
      { upsert: true, new: true }
    );
    const existing = await Quiz.findOne({ title: entry.title });
    if (existing) {
      if (existing.createdBy !== null) {
        existing.createdBy = null;
        await existing.save();
      }
      continue;
    }
    await Quiz.create({
      title: entry.title, description: entry.description, category: category._id,
      subjectKey: entry.subjectKey, unitIndex: entry.unitIndex, difficulty: entry.difficulty,
      durationMinutes: entry.durationMinutes, questions: entry.questions, totalQuestions: entry.questions.length,
      isPublished: true, publishedAt: new Date(), createdBy: null
    });
    created += 1;
  }
  return { created, total: STARTER_QUIZZES.length };
}


export const DEFAULT_SEED_SUBJECT_KEYS = Object.freeze(["SE", "UIUX", "KOTLIN", "DBMS", "ML"]);
