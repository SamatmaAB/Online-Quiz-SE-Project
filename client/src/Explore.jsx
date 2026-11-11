import { useEffect, useState } from "react";
import { fetchCategories, fetchQuizzes } from "./api.js";
import { BackLink, PageHead, QuizCard } from "./components.jsx";
import { Alert, Empty, Icon, Loading, navigate, useApp, useAsync, useRoute } from "./ui.jsx";

const PAGE_SIZE = 12;

export default function Explore() {
  const { token, user } = useApp();
  const route = useRoute();
  const search = route.query.search || "";
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search]);

  const categories = useAsync((signal) => fetchCategories(signal), []);
  const catalog = useAsync((signal) => fetchQuizzes({ category, search, difficulty, sort, page, limit: PAGE_SIZE, token }, signal), [category, search, difficulty, sort, page, token]);

  const pagination = catalog.data?.pagination;
  const quizzes = catalog.data?.quizzes || [];
  const clear = () => { setCategory(""); setDifficulty(""); setSort(""); setPage(1); if (search) navigate("/explore"); };
  const pick = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <div className="page">
      <BackLink to="/">Dashboard</BackLink>
      <PageHead eyebrow="Library" title="Explore quizzes" subtitle={search ? `Results for “${search}”` : user?.role === "admin" ? "Teacher view — showing all published quizzes across all student and teacher accounts." : "Showing built-in quizzes and quizzes created in your account."}>
        <button className="btn btn-primary" onClick={() => navigate("/create")}><Icon name="plus" size={16} /> Create quiz</button>
      </PageHead>

      <div className="toolbar">
        <div className="chips" aria-label="Filter by category">
          <button className={!category ? "chip active" : "chip"} onClick={() => pick(setCategory)("")}>All topics</button>
          {(categories.data?.categories || []).map((item) => (
            <button key={item.id} className={category === item.slug ? "chip active" : "chip"} onClick={() => pick(setCategory)(item.slug)}>{item.name}</button>
          ))}
        </div>
        <div className="row">
          <label className="field">Difficulty
            <select value={difficulty} onChange={(event) => pick(setDifficulty)(event.target.value)}>
              <option value="">Any</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </label>
          <label className="field">Sort
            <select value={sort} onChange={(event) => pick(setSort)(event.target.value)}>
              <option value="">Newest</option><option value="title">Title A–Z</option><option value="shortest">Shortest</option>
            </select>
          </label>
        </div>
      </div>

      <Alert kind="error">{catalog.error}</Alert>
      {catalog.loading ? <Loading label="Finding quizzes…" /> : quizzes.length === 0 && !catalog.error ? (
        <Empty icon="search" title="No quizzes found" action={<button className="btn" onClick={clear}>Clear filters</button>}>Try a different search or topic — or create one yourself.</Empty>
      ) : (
        <>
          <p className="text-muted">{pagination?.total ?? 0} {pagination?.total === 1 ? "quiz" : "quizzes"}</p>
          <div className="grid-auto">{quizzes.map((quiz) => <QuizCard key={quiz.id} quiz={quiz} onDeleted={catalog.reload} />)}</div>
          {pagination?.pages > 1 && (
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><Icon name="arrowLeft" size={16} /> Previous</button>
              <span className="text-muted">Page {page} of {pagination.pages}</span>
              <button className="btn" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)}>Next <Icon name="arrowRight" size={16} /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

