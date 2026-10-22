
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/quizzes"
        );

        if (!response.ok) {
          throw new Error("Failed to fetch subjects");
        }

        const data = await response.json();
        setQuizzes(data.quizzes || []);
      } catch (err) {
        setError(
          "Unable to load subjects. Please make sure the backend server is running."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, []);

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
            <span>{quizzes.length} subjects available</span>
          )}
        </div>

        {loading && (
          <p className="status">Loading subjects...</p>
        )}

        {error && <p className="error">{error}</p>}

        {!loading && !error && quizzes.length === 0 && (
          <p className="status">
            No subjects are available right now.
          </p>
        )}

        {!loading && !error && quizzes.length > 0 && (
          <div className="quiz-grid">
            {quizzes.map((quiz) => (
              <article className="quiz-card" key={quiz.id}>
                <span className="category">
                  {quiz.category}
                </span>

                <h3>{quiz.title}</h3>

                <p className="course-code">
                  Course Code: {quiz.courseCode}
                </p>

                <p className="description">
                  {quiz.description}
                </p>

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
        )}
      </section>
    </main>
  );
}

export default App;
