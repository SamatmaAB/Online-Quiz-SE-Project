import { BackLink, PageHead } from "./components.jsx";
import { Icon, navigate, useApp } from "./ui.jsx";

const features = [
  { icon: "book", title: "Subjects & Units", text: "Five built-in courses (Software Engineering, UI/UX Design, Android with Kotlin, Database Management Systems, Machine Learning), each split into four syllabus units with topics. You can also paste your own syllabus to create a custom subject." },
  { icon: "sparkle", title: "Chints AI", text: "Our quiz assistant. It reads a unit's syllabus topics and drafts multiple-choice questions at the difficulty you pick. It can also split a pasted syllabus into units and topics." },
  { icon: "edit", title: "Quiz Studio", text: "Write questions yourself or generate them with Chints, then review, edit, save as a draft or publish. You can edit or delete a quiz at any time." },
  { icon: "clock", title: "Timed attempts", text: "Every quiz has a countdown. Answers are saved as you go, the quiz auto-submits when time runs out, and you get a full correct/incorrect breakdown afterwards." },
  { icon: "share", title: "Share links", text: "Click Share on any published quiz to copy a direct link. Anyone with an account can open the link and start the test." },
  { icon: "shield", title: "Teacher console", text: "Teachers see every quiz and every student result, can manage categories and promote or demote accounts." }
];

const studentSteps = [
  ["Create an account", "Choose Student on the sign-up form, then sign in."],
  ["Enroll in subjects", "Open Subjects & Units, then press Enroll on the courses you study. Use Add custom subject to paste your own syllabus."],
  ["Open a unit", "Pick a subject, then a unit. The Unit quizzes tab lists quizzes you can take; Syllabus topics lists what the unit covers."],
  ["Take a quiz", "Press Start quiz. Pick an option for each question; the navigator on the right jumps between questions. Submit when every question is answered, or let the timer finish it."],
  ["Review your results", "Attempt History shows every score. Open any attempt to see which answers were right or wrong."],
  ["Make your own quizzes", "Use Create quiz for this unit to write questions yourself, or Generate with Chints to pick topics and a difficulty and let Chints draft them. Your quizzes stay private until you share the link."]
];

const teacherSteps = [
  ["Sign up as a Teacher", "Choose Teacher on the sign-up form to get admin access."],
  ["Build or generate a quiz", "From any unit use Create quiz for this unit (manual) or Generate with Chints (AI-assisted), set the difficulty and duration, then publish."],
  ["Share it", "Press Share to copy the test link and send it to your students."],
  ["Watch the results", "Open Teacher Console → Student Results to see scores and inspect each student's answers."],
  ["Manage the platform", "Teacher Console also lets you see all quizzes (edit or delete any of them), manage categories and change user roles."]
];

const sidebarGuide = [
  ["Dashboard", "Your progress at a glance: quizzes completed, average and best score, enrolled subjects, fresh quizzes and recent activity."],
  ["Subjects & Units", "Browse, enroll in or drop courses, open a unit, and add custom subjects from your own syllabus."],
  ["Explore Catalog", "Search every quiz you can access by title, category or difficulty."],
  ["Attempt History", "All of your past attempts with scores and answer review. Resume an unfinished attempt from here."],
  ["Create Quiz", "Open Quiz Studio to write a quiz manually or generate one with Chints."],
  ["My Quizzes", "Manage the quizzes you created: edit, publish or unpublish, share, try, or delete them."],
  ["My Profile", "View your academic summary, edit your name/email, switch between Student and Teacher roles, or change your password."],
  ["Settings & Theme", "Choose a light, dark or automatic theme and an accent colour."],
  ["About & Guide", "This page — overview, instructions, and FAQs."],
  ["Collapse Sidebar (← / ☰)", "Click the arrow at the top of the sidebar or the menu button in the top bar to slide the sidebar in and out, or click any section heading (LEARN, AUTHORING, etc.) to fold that group."]
];

const faqs = [
  ["Who can see my quizzes?", "Students only see their own quizzes plus the starter quizzes. Teachers can see every quiz. Anyone with a share link can open a published quiz."],
  ["Can I delete a quiz?", "Yes. Use Delete on the quiz card, in My Quizzes, or inside the quiz editor. Results of attempts that were already taken are kept."],
  ["What is the difference between Draft and Published?", "A draft is private to you and cannot be started. A published quiz can be taken and shared."],
  ["Why did Chints use the \"built-in syllabus engine\"?", "Chints uses Google Gemini when the server has a valid GEMINI_API_KEY and the network is reachable. Otherwise it falls back to an offline generator based on the syllabus text, which is simpler."],
  ["My custom subject has odd topics. Can I fix that?", "Open the subject and press Re-split topics with Chints. For best results write headings like \"Unit 1: Name\" and list topics on separate lines or separated by commas."]
];

export default function About() {
  const { user } = useApp();
  const isTeacher = user?.role === "admin";
  return (
    <div className="page about">
      <BackLink to="/">Dashboard</BackLink>
      <PageHead eyebrow="Help" title="About Online Quiz System"
        subtitle="A study and assessment platform: learn by subject and unit, practise with timed quizzes, and build your own quizzes with the help of Chints AI." />

      <section className="card card-pad about-intro">
        <h2>What is this project?</h2>
        <p>
          Online Quiz System is a MERN web application (MongoDB, Express, React, Node.js) built for a Software Engineering course project.
          Students follow their course syllabus unit by unit, take timed multiple-choice quizzes and track their scores. Anyone can author quizzes,
          either by hand or with <b>Chints</b>, an AI assistant that drafts questions from the syllabus topics you choose. Teachers get a console to
          oversee all quizzes and student results.
        </p>
        <div className="row" style={{ gap: 10 }}>
// Stage 1
