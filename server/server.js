
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Sample quiz data for issue #5
const quizzes = [
  {
    id: 1,
    title: "JavaScript Basics",
    description: "Test your knowledge of JavaScript fundamentals.",
    category: "Programming",
    totalQuestions: 10,
    duration: 15,
    available: true
  },
  {
    id: 2,
    title: "DBMS Fundamentals",
    description: "Test your understanding of database concepts.",
    category: "Database",
    totalQuestions: 15,
    duration: 20,
    available: true
  },
  {
    id: 3,
    title: "Data Structures",
    description: "Practice questions on arrays, stacks, and queues.",
    category: "Computer Science",
    totalQuestions: 12,
    duration: 18,
    available: true
  }
];

// API home route
app.get("/", (req, res) => {
  res.json({
    message: "Online Quiz Management System API is running!"
  });
});

// Get all available quizzes
app.get("/api/quizzes", (req, res) => {
  const availableQuizzes = quizzes.filter(
    (quiz) => quiz.available === true
  );

  res.status(200).json({
    success: true,
    count: availableQuizzes.length,
    quizzes: availableQuizzes
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
