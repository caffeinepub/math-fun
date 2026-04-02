import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import {
  ChevronRight,
  Clock,
  Flame,
  LogOut,
  Medal,
  Play,
  RotateCcw,
  Search,
  Star,
  Target,
  TrendingUp,
  Trophy,
  User,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSDK } from "./contexts/SDKProvider";
import {
  useGetLeaderboard,
  useGetStats,
  useUpdateStats,
} from "./hooks/useQueries";

// ─── Types ───────────────────────────────────────────────────────────────────
type Screen = "dashboard" | "game" | "results";
type Difficulty = "easy" | "medium" | "hard";
type Operation = "+" | "-" | "×" | "÷";

interface Question {
  a: number;
  b: number;
  op: Operation;
  answer: number;
  choices: number[];
}

interface GameResult {
  score: number;
  xp: number;
  streak: number;
  newBadges: string[];
  timeLeft: number;
}

interface LocalBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

// ─── Game Logic ───────────────────────────────────────────────────────────────
const BADGE_DEFS: LocalBadge[] = [
  {
    id: "first_win",
    name: "First Win",
    description: "Complete your first game",
    icon: "🏆",
    color: "bg-amber-100 text-amber-700",
  },
  {
    id: "speed_demon",
    name: "Speed Demon",
    description: "Finish with >20s left",
    icon: "⚡",
    color: "bg-yellow-100 text-yellow-700",
  },
  {
    id: "perfect_score",
    name: "Perfect Score",
    description: "Answer all 10 correctly",
    icon: "💯",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "streak_master",
    name: "Streak Master",
    description: "Achieve 5+ streak",
    icon: "🔥",
    color: "bg-red-100 text-red-700",
  },
];

function getRange(difficulty: Difficulty): number {
  if (difficulty === "easy") return 10;
  if (difficulty === "medium") return 20;
  return 50;
}

function getOps(difficulty: Difficulty): Operation[] {
  if (difficulty === "easy") return ["+", "-"];
  return ["+", "-", "×", "÷"];
}

function generateQuestion(difficulty: Difficulty): Question {
  const range = getRange(difficulty);
  const ops = getOps(difficulty);
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number;
  let b: number;
  let answer: number;

  if (op === "+") {
    a = Math.floor(Math.random() * range) + 1;
    b = Math.floor(Math.random() * range) + 1;
    answer = a + b;
  } else if (op === "-") {
    a = Math.floor(Math.random() * range) + 1;
    b = Math.floor(Math.random() * a) + 1;
    answer = a - b;
  } else if (op === "×") {
    const max = difficulty === "hard" ? 12 : 10;
    a = Math.floor(Math.random() * max) + 1;
    b = Math.floor(Math.random() * max) + 1;
    answer = a * b;
  } else {
    b = Math.floor(Math.random() * (difficulty === "hard" ? 12 : 10)) + 1;
    answer = Math.floor(Math.random() * (difficulty === "hard" ? 12 : 10)) + 1;
    a = b * answer;
  }

  const wrongSet = new Set<number>([answer]);
  while (wrongSet.size < 4) {
    const offset = Math.floor(Math.random() * 10) - 5;
    const w = answer + offset;
    if (w !== answer && w >= 0) wrongSet.add(w);
  }
  const choices = Array.from(wrongSet).sort(() => Math.random() - 0.5);

  return { a, b, op, answer, choices };
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = [
  "#2F80ED",
  "#2DD4BF",
  "#F59E0B",
  "#8B5CF6",
  "#22C55E",
  "#FBBF24",
];

function ConfettiEffect() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2 + Math.random() * 2,
    size: 6 + Math.random() * 8,
    shape: Math.random() > 0.5 ? "50%" : "2px",
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: "-20px",
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: p.shape,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Circular Timer ───────────────────────────────────────────────────────────
function CircularTimer({
  timeLeft,
  max = 30,
}: { timeLeft: number; max?: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / max;
  const strokeDashoffset = circumference * (1 - progress);
  const color =
    timeLeft > 15 ? "#2F80ED" : timeLeft > 8 ? "#F59E0B" : "#ef4444";

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: 96, height: 96 }}
    >
      <svg
        width="96"
        height="96"
        className="-rotate-90"
        role="img"
        aria-label="Countdown timer"
      >
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="8"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Clock className="h-3 w-3 text-muted-foreground mb-0.5" />
        <span className="text-2xl font-black leading-none" style={{ color }}>
          {timeLeft}
        </span>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function AppHeader({
  onGoHome,
  walletAddress,
}: { onGoHome: () => void; walletAddress?: string }) {
  return (
    <header className="sticky top-[70px] z-40 bg-white border-b border-border shadow-xs">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
        {/* Brand */}
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-2 shrink-0"
          data-ocid="header.link"
        >
          <span className="text-3xl">🚀</span>
          <span className="font-black text-xl text-foreground leading-none">
            Math<span className="text-primary">Whiz</span>
            <span className="text-accent"> Kid</span>
          </span>
          <span className="text-xs hidden sm:flex gap-0.5 items-center ml-1">
            {["➕", "➖", "✖️", "➗"].map((s) => (
              <span key={s} className="opacity-50">
                {s}
              </span>
            ))}
          </span>
        </button>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1 ml-4 flex-1">
          <Button
            size="sm"
            className="rounded-full px-4 font-bold text-sm"
            onClick={onGoHome}
            data-ocid="nav.play_now.button"
          >
            <Play className="h-3 w-3 mr-1" /> Play Now
          </Button>
          {["Practice", "Games", "Challenges", "Reports", "Parents"].map(
            (label) => (
              <button
                type="button"
                key={label}
                className="px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                data-ocid={`nav.${label.toLowerCase()}.link`}
              >
                {label}
              </button>
            ),
          )}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            type="button"
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Search"
            data-ocid="header.search.button"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-muted transition-colors text-sm font-semibold text-muted-foreground"
            data-ocid="header.parent_portal.button"
          >
            <User className="h-4 w-4" /> Parent Portal
          </button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-border font-bold text-sm hidden sm:flex"
            data-ocid="header.logout.button"
          >
            <LogOut className="h-3 w-3 mr-1" /> Logout
          </Button>
          {/* Profile pill */}
          <button
            type="button"
            className="flex items-center gap-2 bg-muted rounded-full px-3 py-1.5 cursor-pointer"
            data-ocid="header.profile.button"
          >
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black">
              {walletAddress ? walletAddress.slice(0, 2).toUpperCase() : "P"}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-black leading-none">
                {walletAddress ? `${walletAddress.slice(0, 6)}…` : "Player"}{" "}
                (L7)
              </div>
              <div className="flex gap-0.5 mt-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className="h-2.5 w-2.5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({
  onStartGame,
  difficulty,
  setDifficulty,
}: {
  onStartGame: () => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
}) {
  const { data: stats, isLoading } = useGetStats();
  const { data: leaderboard } = useGetLeaderboard();

  const level = Number(stats?.level ?? 1);
  const totalXp = Number(stats?.totalXp ?? 0);
  const streak = Number(stats?.streak ?? 0);
  const highScore = Number(stats?.highScore ?? 0);
  const badges = stats?.badges ?? [];
  const xpForLevel = level * 100;
  const xpProgress = Math.min(((totalXp % xpForLevel) / xpForLevel) * 100, 100);

  const encouragingMessages = [
    "You're a math superstar! ⭐",
    "Keep crushing those numbers! 💪",
    "Every problem makes you smarter! 🧠",
  ];
  const msg =
    encouragingMessages[Math.floor(totalXp / 50) % encouragingMessages.length];

  return (
    <div className="min-h-screen bg-background pt-[70px]">
      {/* Hero Banner */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #dbeafe 0%, #e0f2fe 40%, #ccfbf1 100%)",
        }}
      >
        {/* Decorative shapes */}
        <div className="absolute inset-0 pointer-events-none">
          {["⭐", "➕", "🌟", "✖️", "💫", "➗", "🔢", "🎯"].map((emoji, i) => (
            <span
              key={emoji}
              className="absolute text-2xl opacity-30 select-none"
              style={{
                left: `${8 + i * 12}%`,
                top: `${10 + (i % 3) * 28}%`,
                transform: `rotate(${i * 23}deg)`,
                fontSize: `${1 + (i % 3) * 0.5}rem`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>

        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center gap-8 relative z-10">
          {/* Mascot */}
          <motion.div
            className="shrink-0 animate-float"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <img
              src="/assets/generated/math-mascot-transparent.dim_400x400.png"
              alt="MathWhiz mascot"
              className="w-40 h-40 md:w-52 md:h-52 object-contain drop-shadow-xl"
            />
          </motion.div>

          {/* Welcome content */}
          <motion.div
            className="flex-1 text-center md:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p className="text-sm font-bold text-primary uppercase tracking-wider mb-1">
              Welcome Back, Ava! 👋
            </p>
            <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight mb-2">
              Ready to <span className="text-primary">Master Math</span>?
            </h1>
            <p className="text-muted-foreground font-semibold mb-1">{msg}</p>
            <div className="flex items-center gap-2 justify-center md:justify-start mb-5">
              <div className="flex items-center gap-1 bg-white/70 rounded-full px-3 py-1">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-black text-sm">{totalXp} XP</span>
              </div>
              <div className="flex items-center gap-1 bg-white/70 rounded-full px-3 py-1">
                <Flame className="h-4 w-4 text-red-500" />
                <span className="font-black text-sm">{streak} Streak</span>
              </div>
              <div className="flex items-center gap-1 bg-white/70 rounded-full px-3 py-1">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="font-black text-sm">L{level}</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Button
                size="lg"
                className="rounded-full px-8 text-base font-black shadow-lg hover:shadow-xl transition-all hover:scale-105"
                onClick={onStartGame}
                data-ocid="dashboard.play.primary_button"
              >
                <Play className="h-5 w-5 mr-2" /> Start Playing!
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 text-base font-bold border-2 bg-white/70 hover:bg-white"
                data-ocid="dashboard.leaderboard.secondary_button"
              >
                <Trophy className="h-5 w-5 mr-2 text-amber-500" /> Leaderboard
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Stats row */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {[
            {
              label: "Total XP",
              value: isLoading ? "…" : totalXp,
              icon: <Zap className="h-5 w-5 text-amber-500" />,
              color: "bg-amber-50 border-amber-200",
              data: "xp",
            },
            {
              label: "Badges",
              value: isLoading ? "…" : badges.length,
              icon: (
                <Medal
                  className="h-5 w-5"
                  style={{ color: "oklch(0.58 0.22 285)" }}
                />
              ),
              color: "bg-purple-50 border-purple-200",
              data: "badges",
            },
            {
              label: "High Score",
              value: isLoading ? "…" : `${highScore}/10`,
              icon: <Target className="h-5 w-5 text-primary" />,
              color: "bg-blue-50 border-blue-200",
              data: "score",
            },
            {
              label: "Best Streak",
              value: isLoading ? "…" : streak,
              icon: <Flame className="h-5 w-5 text-red-500" />,
              color: "bg-red-50 border-red-200",
              data: "streak",
            },
          ].map((stat) => (
            <Card
              key={stat.data}
              className={`border-2 ${stat.color} shadow-card hover:shadow-card-hover transition-shadow`}
              data-ocid={`stats.${stat.data}.card`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  {stat.icon}
                  <TrendingUp className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="text-2xl font-black">{stat.value}</div>
                <div className="text-xs font-semibold text-muted-foreground mt-0.5">
                  {stat.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Level XP bar */}
        <motion.div
          className="bg-white rounded-2xl border-2 border-border p-5 shadow-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-black text-sm">
                L{level}
              </div>
              <div>
                <div className="font-black text-sm">Level {level}</div>
                <div className="text-xs text-muted-foreground font-semibold">
                  {totalXp % xpForLevel} / {xpForLevel} XP to Level {level + 1}
                </div>
              </div>
            </div>
            <Zap className="h-5 w-5 text-amber-500" />
          </div>
          <Progress value={xpProgress} className="h-3 rounded-full" />
        </motion.div>

        {/* Two-column: Math Adventure + Difficulty Selector */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Current Math Adventure */}
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <Card className="border-2 border-primary/20 shadow-card h-full">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-xl">🎮</span>
                  </div>
                  <div>
                    <h2 className="font-black text-lg">
                      Current Math Adventure
                    </h2>
                    <p className="text-sm text-muted-foreground font-semibold">
                      Select difficulty and start!
                    </p>
                  </div>
                </div>

                {/* Difficulty selector */}
                <div
                  className="grid grid-cols-3 gap-3 mb-5"
                  data-ocid="difficulty.select"
                >
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
                    const config = {
                      easy: {
                        label: "Easy",
                        emoji: "🌟",
                        desc: "Add & Sub\n1–10",
                        color:
                          "border-emerald-400 bg-emerald-50 text-emerald-700",
                      },
                      medium: {
                        label: "Medium",
                        emoji: "⚡",
                        desc: "All ops\n1–20",
                        color: "border-amber-400 bg-amber-50 text-amber-700",
                      },
                      hard: {
                        label: "Hard",
                        emoji: "🔥",
                        desc: "All ops\n1–50",
                        color: "border-red-400 bg-red-50 text-red-700",
                      },
                    }[d];
                    const isActive = difficulty === d;
                    return (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`rounded-2xl border-2 p-4 text-center transition-all font-bold ${
                          isActive
                            ? `${config.color} shadow-md scale-105 ring-2 ring-offset-2 ring-current`
                            : "border-border bg-muted hover:border-primary/40 hover:bg-white"
                        }`}
                        data-ocid={`difficulty.${d}.button`}
                      >
                        <div className="text-2xl mb-1">{config.emoji}</div>
                        <div className="text-sm font-black">{config.label}</div>
                        <div className="text-xs opacity-70 whitespace-pre-line mt-0.5">
                          {config.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Button
                  size="lg"
                  className="w-full rounded-full font-black text-base shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                  onClick={onStartGame}
                  data-ocid="adventure.play.primary_button"
                >
                  <Play className="h-5 w-5 mr-2" />
                  Play{" "}
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}{" "}
                  Mode!
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Today's Challenge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card
              className="border-2 border-secondary/30 shadow-card h-full"
              style={{ background: "linear-gradient(145deg, #f0fdf9, #fff)" }}
            >
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "oklch(0.79 0.13 188 / 0.15)" }}
                  >
                    <span className="text-xl">🎯</span>
                  </div>
                  <div>
                    <h2 className="font-black text-base">Today's Challenge</h2>
                    <Badge
                      className="text-xs"
                      style={{
                        backgroundColor: "oklch(0.79 0.13 188 / 0.2)",
                        color: "oklch(0.45 0.12 188)",
                      }}
                    >
                      Daily
                    </Badge>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {[
                    {
                      q: "12 × 8 = ?",
                      reward: "+25 XP",
                      color: "text-primary",
                    },
                    {
                      q: "144 ÷ 12 = ?",
                      reward: "+30 XP",
                      color: "text-emerald-600",
                    },
                    {
                      q: "37 + 48 = ?",
                      reward: "+20 XP",
                      color: "text-amber-600",
                    },
                  ].map((challenge, i) => (
                    <div
                      key={challenge.q}
                      className="flex items-center justify-between bg-white rounded-xl p-3 border border-border"
                      data-ocid={`challenge.item.${i + 1}`}
                    >
                      <span className="font-black text-sm">{challenge.q}</span>
                      <span className={`text-xs font-black ${challenge.color}`}>
                        {challenge.reward}
                      </span>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full mt-4 rounded-full font-bold"
                  style={{
                    backgroundColor: "oklch(0.79 0.13 188)",
                    color: "white",
                  }}
                  size="sm"
                  data-ocid="challenge.start.button"
                  onClick={onStartGame}
                >
                  Accept Challenge <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Badges section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-xl">🏅 Your Badges</h2>
            <span className="text-sm text-muted-foreground font-semibold">
              {badges.length}/{BADGE_DEFS.length} earned
            </span>
          </div>
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            data-ocid="badges.list"
          >
            {BADGE_DEFS.map((badge, i) => {
              const earned = badges.some((b) => b.name === badge.name);
              return (
                <Card
                  key={badge.id}
                  className={`border-2 transition-all ${
                    earned
                      ? "border-amber-300 shadow-card"
                      : "border-border opacity-50"
                  }`}
                  data-ocid={`badge.item.${i + 1}`}
                >
                  <CardContent className="p-4 text-center">
                    <div
                      className={`text-3xl mb-2 ${earned ? "" : "grayscale"}`}
                    >
                      {badge.icon}
                    </div>
                    <div className="font-black text-sm">{badge.name}</div>
                    <div className="text-xs text-muted-foreground font-semibold mt-1">
                      {badge.description}
                    </div>
                    {earned && (
                      <Badge className="mt-2 text-xs bg-amber-100 text-amber-700 border-amber-300">
                        Earned!
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <h2 className="font-black text-xl mb-4">🏆 Leaderboard</h2>
          <Card className="border-2 border-border shadow-card">
            <CardContent className="p-0">
              {leaderboard && leaderboard.length > 0 ? (
                leaderboard.slice(0, 5).map(([principal, score], i) => (
                  <div
                    key={principal.toString()}
                    className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-0"
                    data-ocid={`leaderboard.item.${i + 1}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                        i === 0
                          ? "bg-amber-400 text-white"
                          : i === 1
                            ? "bg-slate-300 text-slate-700"
                            : i === 2
                              ? "bg-amber-600/80 text-white"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-sm">
                        {principal.toString().slice(0, 12)}…
                      </div>
                    </div>
                    <div className="font-black text-primary">
                      {Number(score)} pts
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className="text-center py-10 text-muted-foreground"
                  data-ocid="leaderboard.empty_state"
                >
                  <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-bold">No scores yet — be the first!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span className="text-xl">🚀</span>
            <span>MathWhiz Kid — Making Math Fun Since 2024</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()}. Built with ❤ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              className="text-primary hover:underline font-semibold"
            >
              caffeine.ai
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Game Screen ─────────────────────────────────────────────────────────────
const ENCOURAGEMENTS_CORRECT = [
  "Amazing! 🌟",
  "You're on fire! 🔥",
  "Brilliant! 💡",
  "Keep it up! 💪",
  "Genius! 🧠",
  "Unstoppable! ⚡",
];
const ENCOURAGEMENTS_WRONG = [
  "Almost! Try again! 😊",
  "Keep going! 💪",
  "You got this! 🎯",
  "Don't give up! 🌈",
];
function GameScreen({
  difficulty,
  onFinish,
}: {
  difficulty: Difficulty;
  onFinish: (result: GameResult) => void;
}) {
  const [questions] = useState<Question[]>(() =>
    Array.from({ length: 10 }, () => generateQuestion(difficulty)),
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [shakingChoice, setShakingChoice] = useState<number | null>(null);
  const [encouragement, setEncouragement] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQ = questions[questionIndex];

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const advance = useCallback(
    (
      currentScore: number,
      _currentStreak: number,
      currentXp: number,
      currentMaxStreak: number,
      tLeft: number,
    ) => {
      clearTimer();
      const nextIndex = questionIndex + 1;
      if (nextIndex >= 10) {
        // Check badges
        const newBadges: string[] = [];
        if (currentScore === 10) newBadges.push("perfect_score");
        if (tLeft > 20) newBadges.push("speed_demon");
        if (currentMaxStreak >= 5) newBadges.push("streak_master");
        newBadges.push("first_win");
        onFinish({
          score: currentScore,
          xp: currentXp,
          streak: currentMaxStreak,
          newBadges,
          timeLeft: tLeft,
        });
      } else {
        setQuestionIndex(nextIndex);
        setSelected(null);
        setFeedback(null);
        setShakingChoice(null);
        setEncouragement("");
        setTimeLeft(30);
      }
    },
    [questionIndex, clearTimer, onFinish],
  );

  const handleAnswer = useCallback(
    (choice: number) => {
      if (selected !== null) return;
      clearTimer();
      setSelected(choice);

      const isCorrect = choice === currentQ.answer;

      if (isCorrect) {
        const newStreak = streak + 1;
        const newMaxStreak = Math.max(maxStreak, newStreak);
        const bonusXp = newStreak >= 3 ? 5 : 0;
        const gainedXp = 10 + bonusXp;
        const newScore = score + 1;
        const newXp = xp + gainedXp;
        setStreak(newStreak);
        setMaxStreak(newMaxStreak);
        setScore(newScore);
        setXp(newXp);
        setFeedback("correct");
        setEncouragement(
          ENCOURAGEMENTS_CORRECT[
            Math.floor(Math.random() * ENCOURAGEMENTS_CORRECT.length)
          ],
        );
        setTimeout(
          () => advance(newScore, newStreak, newXp, newMaxStreak, timeLeft),
          1000,
        );
      } else {
        setStreak(0);
        setShakingChoice(choice);
        setFeedback("wrong");
        setEncouragement(
          ENCOURAGEMENTS_WRONG[
            Math.floor(Math.random() * ENCOURAGEMENTS_WRONG.length)
          ],
        );
        setTimeout(() => advance(score, 0, xp, maxStreak, timeLeft), 1000);
      }
    },
    [
      selected,
      currentQ,
      streak,
      maxStreak,
      score,
      xp,
      timeLeft,
      clearTimer,
      advance,
    ],
  );

  // Timer
  // biome-ignore lint/correctness/useExhaustiveDependencies: timer depends on questionIndex reset
  useEffect(() => {
    if (selected !== null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAnswer(-1); // Force wrong
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [questionIndex, selected]);

  const opColors: Record<Operation, string> = {
    "+": "#2F80ED",
    "-": "#8B5CF6",
    "×": "#F59E0B",
    "÷": "#2DD4BF",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pt-[70px]">
      {/* Game top bar */}
      <div className="bg-white border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1.5">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-black text-sm text-primary">
                {score}/10
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-red-50 rounded-full px-3 py-1.5">
              <Flame className="h-4 w-4 text-red-500" />
              <span className="font-black text-sm text-red-600">{streak}x</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-50 rounded-full px-3 py-1.5">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="font-black text-sm text-amber-600">{xp} XP</span>
            </div>
          </div>
          <div className="text-sm font-bold text-muted-foreground">
            Q {questionIndex + 1} of 10
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(questionIndex / 10) * 100}%` }}
        />
      </div>

      {/* Main game area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Timer + Question */}
          <motion.div
            className="bg-white rounded-3xl border-2 border-border shadow-card p-8 mb-6 text-center"
            key={questionIndex}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            data-ocid="game.question.card"
          >
            <div className="flex justify-center mb-6">
              <CircularTimer timeLeft={timeLeft} />
            </div>

            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-5xl font-black">{currentQ.a}</span>
              <span
                className="text-4xl font-black px-3 py-1 rounded-xl"
                style={{
                  backgroundColor: `${opColors[currentQ.op]}20`,
                  color: opColors[currentQ.op],
                }}
              >
                {currentQ.op}
              </span>
              <span className="text-5xl font-black">{currentQ.b}</span>
              <span className="text-4xl font-black text-muted-foreground">
                =
              </span>
              <span className="text-5xl font-black text-muted-foreground/40">
                ?
              </span>
            </div>

            {/* Encouragement */}
            <AnimatePresence>
              {encouragement && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`mt-3 text-lg font-black ${
                    feedback === "correct" ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {feedback === "correct" ? "✓ " : "✗ "}
                  {encouragement}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Answer choices */}
          <div
            className="grid grid-cols-2 gap-4"
            data-ocid="game.answers.panel"
          >
            {currentQ.choices.map((choice, i) => {
              const isSelected = selected === choice;
              const isCorrect = choice === currentQ.answer;
              const showFeedback = selected !== null;

              let buttonClass =
                "rounded-2xl border-2 p-5 text-center text-2xl font-black transition-all cursor-pointer ";
              if (!showFeedback) {
                buttonClass +=
                  "bg-white border-border hover:border-primary hover:bg-primary/5 hover:scale-105 active:scale-95 shadow-card hover:shadow-card-hover";
              } else if (isCorrect) {
                buttonClass +=
                  "bg-emerald-500 border-emerald-500 text-white scale-105 shadow-lg";
              } else if (isSelected && !isCorrect) {
                buttonClass += "bg-red-500 border-red-500 text-white";
              } else {
                buttonClass +=
                  "bg-white border-border opacity-50 cursor-not-allowed";
              }

              return (
                <motion.button
                  key={`${questionIndex}-choice-${choice}`}
                  className={`${buttonClass} ${isSelected && !isCorrect && shakingChoice === choice ? "animate-shake" : ""}`}
                  onClick={() => handleAnswer(choice)}
                  disabled={selected !== null}
                  whileTap={{ scale: selected === null ? 0.95 : 1 }}
                  data-ocid={`game.answer.button.${i + 1}`}
                >
                  {showFeedback && isCorrect && "✓ "}
                  {showFeedback && isSelected && !isCorrect && "✗ "}
                  {choice}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Results Screen ────────────────────────────────────────────────────────────
function ResultsScreen({
  result,
  onPlayAgain,
  onGoHome,
}: {
  result: GameResult;
  onPlayAgain: () => void;
  onGoHome: () => void;
}) {
  const { mutate: updateStats } = useUpdateStats();
  const isPerfect = result.score === 10;
  const [showConfetti, setShowConfetti] = useState(isPerfect);

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    // Persist to backend
    const badgesToSave = result.newBadges.map((id) => {
      const def = BADGE_DEFS.find((b) => b.id === id);
      return { name: def?.name ?? id, description: def?.description ?? "" };
    });
    updateStats({
      score: BigInt(result.score),
      xp: BigInt(result.xp),
      streak: BigInt(result.streak),
      badges: badgesToSave,
    });

    if (isPerfect) {
      toast.success("Perfect Score! Amazing job! 🎉");
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const grade =
    result.score === 10
      ? {
          label: "Perfect! 🌟",
          color: "text-amber-500",
          bg: "bg-amber-50 border-amber-300",
        }
      : result.score >= 8
        ? {
            label: "Excellent! 🎉",
            color: "text-emerald-600",
            bg: "bg-emerald-50 border-emerald-300",
          }
        : result.score >= 6
          ? {
              label: "Good Job! 👍",
              color: "text-blue-600",
              bg: "bg-blue-50 border-blue-300",
            }
          : result.score >= 4
            ? {
                label: "Keep Trying! 💪",
                color: "text-amber-600",
                bg: "bg-amber-50 border-amber-300",
              }
            : {
                label: "Practice More! 📚",
                color: "text-muted-foreground",
                bg: "bg-muted border-border",
              };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 pt-[70px] pb-10">
      {showConfetti && <ConfettiEffect />}

      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        <Card
          className="border-2 border-border shadow-card overflow-hidden"
          data-ocid="results.panel"
        >
          {/* Score header */}
          <div
            className="text-center py-8 px-6"
            style={{
              background:
                "linear-gradient(135deg, #dbeafe 0%, #e0f2fe 60%, #ccfbf1 100%)",
            }}
          >
            <motion.div
              className="text-6xl mb-3"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              {isPerfect ? "🏆" : result.score >= 7 ? "⭐" : "🎯"}
            </motion.div>
            <h1 className="text-2xl font-black mb-1">Game Complete!</h1>
            <div
              className={`inline-block px-4 py-1.5 rounded-full border-2 font-black text-lg ${grade.bg} ${grade.color}`}
            >
              {grade.label}
            </div>
          </div>

          <CardContent className="p-6 space-y-5">
            {/* Score breakdown */}
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                {
                  label: "Score",
                  value: `${result.score}/10`,
                  icon: "🎯",
                  color: "text-primary",
                },
                {
                  label: "XP Earned",
                  value: `+${result.xp}`,
                  icon: "⚡",
                  color: "text-amber-600",
                },
                {
                  label: "Best Streak",
                  value: `${result.streak}x`,
                  icon: "🔥",
                  color: "text-red-600",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-muted rounded-2xl p-3"
                  data-ocid={`results.${stat.label.toLowerCase().replace(" ", "_")}.card`}
                >
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className={`text-xl font-black ${stat.color}`}>
                    {stat.value}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* New badges */}
            {result.newBadges.length > 0 && (
              <div>
                <h3 className="font-black text-sm text-muted-foreground uppercase tracking-wider mb-3">
                  🏅 New Badges Earned!
                </h3>
                <div
                  className="flex flex-wrap gap-2"
                  data-ocid="results.badges.panel"
                >
                  {result.newBadges.map((id) => {
                    const def = BADGE_DEFS.find((b) => b.id === id);
                    if (!def) return null;
                    return (
                      <motion.div
                        key={id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 font-bold text-sm ${def.color} border-current/30`}
                      >
                        <span>{def.icon}</span> {def.name}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA buttons */}
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full rounded-full font-black text-base shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                onClick={onPlayAgain}
                data-ocid="results.play_again.primary_button"
              >
                <RotateCcw className="h-5 w-5 mr-2" /> Play Again!
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-full font-bold text-base border-2"
                onClick={onGoHome}
                data-ocid="results.home.secondary_button"
              >
                🏠 Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function MathApp() {
  const { sdk, isConnecting, walletAddress } = useSDK();
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: connect once on mount
  useEffect(() => {
    sdk.connection();
  }, [sdk.connection]);

  const handleStartGame = () => setScreen("game");
  const handleFinish = (result: GameResult) => {
    setGameResult(result);
    setScreen("results");
  };
  const handlePlayAgain = () => setScreen("game");
  const handleGoHome = () => setScreen("dashboard");

  if (isConnecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background pt-[70px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
          className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent"
        />
        <p className="text-muted-foreground font-semibold text-sm">
          Connecting to Metanet...
        </p>
      </div>
    );
  }

  return (
    <>
      <AppHeader
        onGoHome={handleGoHome}
        walletAddress={walletAddress ?? undefined}
      />
      <AnimatePresence mode="wait">
        {screen === "dashboard" && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Dashboard
              onStartGame={handleStartGame}
              difficulty={difficulty}
              setDifficulty={setDifficulty}
            />
          </motion.div>
        )}
        {screen === "game" && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <GameScreen difficulty={difficulty} onFinish={handleFinish} />
          </motion.div>
        )}
        {screen === "results" && gameResult && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ResultsScreen
              result={gameResult}
              onPlayAgain={handlePlayAgain}
              onGoHome={handleGoHome}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
    </>
  );
}

export default function App() {
  return <MathApp />;
}
