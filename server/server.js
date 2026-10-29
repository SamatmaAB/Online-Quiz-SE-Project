
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const quizzes = [
  {
    id: 1,
    title: "Software Engineering",
    courseCode: "UE24CS341A",
    category: "Core Course",
    description: "Learn software development and engineering concepts.",
    duration: 30,
    createdAt: "2026-10-20T10:00:00Z"
  },
  {
    id: 2,
    title: "Data Analytics",
    courseCode: "UE24CS342AA2",
    category: "Elective",
    description: "Explore data analysis and visualization concepts.",
    duration: 20,
    createdAt: "2026-10-25T10:00:00Z"
  },
  {
    id: 3,
    title: "Enterprise Business Systems",
    courseCode: "UE24CS343AB8",
    category: "Elective",
    description: "Learn about enterprise systems and business processes.",
    duration: 45,
    createdAt: "2026-10-22T10:00:00Z"
  },
  {
    id: 4,
    title: "Database Management System",
    courseCode: "UE24CS351A",
    category: "Core Course",
    description: "Practise database concepts and SQL fundamentals.",
    duration: 15,
    createdAt: "2026-10-28T10:00:00Z"
  },
  {
    id: 5,
    title: "Machine Learning",
    courseCode: "UE24CS352A",
    category: "Core Course",
    description: "Explore machine learning algorithms and concepts.",
    duration: 30,
    createdAt: "2026-10-26T10:00:00Z"
  }
];

const ALLOWED_SORTS = [
  "title-asc",
  "title-desc",
  "duration-asc",
  "newest"
];

app.get("/", (req, res) => {
  res.json({
    message: "Online Quiz Management System API is running!"
  });
});

app.get("/api/quizzes", (req, res) => {
  const sort = req.query.sort || "title-asc";
  const search = String(req.query.search || "").trim().toLowerCase();
  const category = String(req.query.category || "All").trim();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 6);

  if (!ALLOWED_SORTS.includes(sort)) {
    return res.status(400).json({
      success: false,
      message: "Invalid sort value.",
      allowedSorts: ALLOWED_SORTS
    });
  }

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Page must be a positive integer. Limit must be between 1 and 100."
    });
  }

  const availableCategories = [...new Set(quizzes.map((quiz) => quiz.category))];

  if (category !== "All" && !availableCategories.includes(category)) {
    return res.status(400).json({
      success: false,
      message: "Invalid category.",
      allowedCategories: ["All", ...availableCategories]
    });
  }

  let results = quizzes.filter((quiz) => {
    const matchesSearch =
      quiz.title.toLowerCase().includes(search) ||
      quiz.courseCode.toLowerCase().includes(search) ||
      quiz.description.toLowerCase().includes(search);

    const matchesCategory =
      category === "All" || quiz.category === category;

    return matchesSearch && matchesCategory;
  });

  results.sort((a, b) => {
    let comparison = 0;

    switch (sort) {
      case "title-asc":
        comparison = a.title.localeCompare(b.title);
        break;
      case "title-desc":
        comparison = b.title.localeCompare(a.title);
        break;
      case "duration-asc":
        comparison = a.duration - b.duration;
        break;
      case "newest":
        comparison =
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime();
        break;
    }

    return comparison || a.id - b.id;
  });

  const total = results.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedQuizzes = results.slice(startIndex, startIndex + limit);

  res.status(200).json({
    success: true,
    count: paginatedQuizzes.length,
    total,
    page,
    limit,
    totalPages,
    sort,
    search,
    category,
    quizzes: paginatedQuizzes
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
