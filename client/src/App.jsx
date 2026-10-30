
import { useEffect, useState } from "react";
import "./App.css";

const PAGE_SIZE = 6;

const sortOptions = [
  { value: "title-asc", label: "Title: A–Z" },
  { value: "title-desc", label: "Title: Z–A" },
  { value: "duration-asc", label: "Shortest duration" },
  { value: "newest", label: "Newest first" },
];

function App() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("title-asc");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchQuizzes() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `http://localhost:5000/api/quizzes?sort=${encodeURIComponent(sort)}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch quizzes.");
        }

        setQuizzes(data.quizzes || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            "Unable to load quizzes. Please make sure the backend server is running."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchQuizzes();

    return () => controller.abort();
  }, [sort]);

  const categories = [
    "All",
    ...new Set(quizzes.map((quiz) => quiz.category).filter(Boolean)),
  ];

  const filteredQuizzes = quizzes.filter((quiz) => {
    const searchText = search.trim().toLowerCase();

    const matchesSearch =
      quiz.title.toLowerCase().includes(searchText) ||
      (quiz.courseCode || "").toLowerCase().includes(searchText) ||
      (quiz.description || "").toLowerCase().includes(searchText);

    const matchesCategory =
      category === "All" || quiz.category === category;

    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredQuizzes.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;

  const visibleQuizzes = filteredQuizzes.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  function handleSortChange(event) {
    setSort(event.target.value);
    setPage(1);
  }

  function handleSearchChange(event) {
    setSearch(event.target.value);
    setPage(1);
  }

  function handleCategoryChange(event) {
    setCategory(event.target.value);
    setPage(1);
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">PES UNIVERSITY | SEMESTER 5</p>

        <h1>Available Quizzes</h1>

        <p>
          Select a subject and prepare for your semester
          exams with subject-wise quizzes.
        </p>
      </header>

      <section className="quiz-section">
        <div className="section-heading">
          <h2>Explore Your Subjects</h2>

          {!loading && !error && (
            <span>
              {filteredQuizzes.length}{" "}
              {filteredQuizzes.length === 1 ? "subject" : "subjects"} found
            </span>
          )}
        </div>

        <div className="quiz-controls">
          <div className="control-group search-control">
            <label htmlFor="quiz-search">Search subjects</label>
            <input
              id="quiz-search"
              type="search"
              placeholder="Search by title, code, or description"
              value={search}
              onChange={handleSearchChange}
            />
          </div>

          <div className="control-group">
            <label htmlFor="quiz-category">Category</label>
            <select
              id="quiz-category"
              value={category}
              onChange={handleCategoryChange}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All categories" : item}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="quiz-sort">Sort quizzes by</label>
            <select
              id="quiz-sort"
              value={sort}
              onChange={handleSortChange}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="status">Loading quizzes...</p>}

        {error && <p className="error">{error}</p>}

        {!loading && !error && filteredQuizzes.length === 0 && (
          <p className="status">
            No quizzes match your search or category. Try changing your filters.
          </p>
        )}

        {!loading && !error && visibleQuizzes.length > 0 && (
          <>
            <div className="quiz-grid">
              {visibleQuizzes.map((quiz) => (
                <article className="quiz-card" key={quiz.id}>
                  <span className="category">{quiz.category}</span>

                  <h3>{quiz.title}</h3>

                  <p className="course-code">
                    Course Code: {quiz.courseCode}
                  </p>

                  <p className="description">{quiz.description}</p>

                  {Number.isFinite(Number(quiz.duration)) && (
                    <p className="quiz-duration">
                      <span aria-hidden="true">◷</span>{" "}
                      {quiz.duration} minutes
                    </p>
                  )}

                  <button
                    className="start-button"
                    onClick={() =>
                      alert(
                        `${quiz.title} selected. Quiz questions will be available soon!`
                      )
                    }
                  >
                    View Quiz →
                  </button>
                </article>
              ))}
            </div>

            <nav className="pagination" aria-label="Quiz pages">
              <button
                type="button"
                onClick={() => setPage((current) => current - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>

              <span aria-live="polite">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </nav>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
