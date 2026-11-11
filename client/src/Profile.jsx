import { useEffect, useState } from "react";
import { changePassword, fetchMyAttempts, fetchMyQuizzes, fetchProfile, fetchSubjects, updateProfile } from "./api.js";
import { BackLink, PageHead, scoreKind } from "./components.jsx";
import { Alert, Badge, Icon, Loading, formatDate, formatDay, hueFor, initials, navigate, subjectBadge, useApp, useAsync, useToast } from "./ui.jsx";

export default function Profile() {
  const { token, user, updateSession } = useApp();
  const toast = useToast();

  const { data, loading, error } = useAsync(async (signal) => {
    const [profileRes, subjectsRes, attemptsRes, quizzesRes] = await Promise.all([
      fetchProfile(token, signal).catch(() => ({ user })),
      fetchSubjects(token, signal).catch(() => ({ subjects: [] })),
      fetchMyAttempts(token, signal).catch(() => ({ attempts: [] })),
      fetchMyQuizzes(token, { all: false }, signal).catch(() => ({ quizzes: [] }))
    ]);
    return {
      profile: profileRes.user || user,
      subjects: subjectsRes.subjects || [],
      attempts: attemptsRes.attempts || [],
      myQuizzes: quizzesRes.quizzes || []
    };
  }, [token]);

  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [role, setRole] = useState(user.role === "admin" ? "teacher" : "student");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErr, setProfileErr] = useState("");

  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdErr, setPwdErr] = useState("");

  useEffect(() => {
    if (data?.profile) {
      setName(data.profile.name || "");
      setEmail(data.profile.email || "");
      setRole(data.profile.role === "admin" ? "teacher" : "student");
    }
  }, [data?.profile]);

  async function handleSaveProfile(event) {
    event.preventDefault();
    setProfileErr("");
    setSavingProfile(true);
    try {
      const res = await updateProfile({ name: name.trim(), email: email.trim(), role }, token);
      updateSession?.({ token: res.token, user: res.user });
      toast("Profile updated!");
    } catch (err) {
      setProfileErr(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setPwdErr("");
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPwdErr("New passwords do not match.");
      return;
    }
    setSavingPwd(true);
    try {
      const res = await changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      }, token);
      updateSession?.({ token: res.token, user: res.user });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast(res.message || "Password updated!");
    } catch (err) {
      setPwdErr(err.message);
    } finally {
      setSavingPwd(false);
    }
// Stage 1
