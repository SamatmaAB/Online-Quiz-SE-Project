
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
          throw new Error("Failed to load quizzes.");
        }

        const data = await response.json();
        setQuizzes(data.quizzes);
      } catch (err) {
        setError(
          "Unable to load quizzes. Please check whether the server is running."
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
        <p className="eyebrow">ONLINE LEARNING</p>
        <h1>Available Quizzes</h1>
        <p>
          Test your knowledge, practise your skills,
          and track your learning.
        </p>
      </header>

      <section className="quiz-section">
        <div className="section-heading">
          <h2>Explore Quizzes</h2>
          {!loading && !error && (
            <span>{quizzes.length} quizzes available</span>
          )}
        </div>

        {loading && <p className="status">Loading quizzes...</p>}

        {error && <p className="error">{error}</p>}

        {!loading && !error && quizzes.length === 0 && (
          <p className="status">No quizzes are available right now.</p>
        )}

        {!loading && !error && quizzes.length > 0 && (
          <div className="quiz-grid">
            {quizzes.map((quiz) => (
              <article className="quiz-card" key={quiz.id}>
                <span className="category">{quiz.category}</span>
                <h3>{quiz.title}</h3>
                <p className="description">{quiz.description}</p>

                <div className="quiz-details">
                  <span>📝 {quiz.totalQuestions} questions</span>
                  <span>⏱️ {quiz.duration} minutes</span>
                </div>

                <button
                  className="start-button"
                  onClick={() =>
                    alert(`You selected ${quiz.title}`)
                  }
                >
                  View Quiz
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
