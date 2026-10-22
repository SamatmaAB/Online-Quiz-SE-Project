
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
    title: "Software Engineering",
    courseCode: "UE24CS341A",
    category: "Core Course",
    description: "Learn software development and engineering concepts."
  },
  {
    id: 2,
    title: "Data Analytics",
    courseCode: "UE24CS342AA2",
    category: "Elective",
    description: "Explore data analysis and visualization concepts."
  },
  {
    id: 3,
    title: "Enterprise Business Systems",
    courseCode: "UE24CS343AB8",
    category: "Elective",
    description: "Learn about enterprise systems and business processes."
  },
  {
    id: 4,
    title: "Database Management System",
    courseCode: "UE24CS351A",
    category: "Core Course",
    description: "Practise database concepts and SQL fundamentals."
  },
  {
    id: 5,
    title: "Machine Learning",
    courseCode: "UE24CS352A",
    category: "Core Course",
    description: "Explore machine learning algorithms and concepts."
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
  res.status(200).json({
    success: true,
    count: quizzes.length,
    quizzes: quizzes
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
