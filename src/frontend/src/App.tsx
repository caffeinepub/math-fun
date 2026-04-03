import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import {
  BarChart2,
  ChevronRight,
  Clock,
  Flame,
  Medal,
  Play,
  RotateCcw,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
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
type Screen =
  | "dashboard"
  | "game"
  | "results"
  | "leaderboard"
  | "stats"
  | "parents";
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

// ─── Badge Definitions ────────────────────────────────────────────────────────
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

// ─── Game Logic ───────────────────────────────────────────────────────────────
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

// ─── Floating Footer Nav ──────────────────────────────────────────────────────
function FloatingFooterNav({
  activeScreen,
  onNavigate,
}: {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  const tabs = [
    {
      id: "dashboard" as Screen,
      icon: "🎮",
      label: "Play",
      ocid: "footer.play.tab",
    },
    {
      id: "leaderboard" as Screen,
      icon: "🏆",
      label: "Top",
      ocid: "footer.leaderboard.tab",
    },
    {
      id: "stats" as Screen,
      icon: "📊",
      label: "Stats",
      ocid: "footer.stats.tab",
    },
    {
      id: "parents" as Screen,
      icon: "👨‍👩‍👧",
      label: "Parents",
      ocid: "footer.parents.tab",
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background:
          "linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)",
      }}
      data-ocid="footer.nav"
    >
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-stretch justify-around h-16">
          {tabs.map((tab) => {
            const isActive =
              activeScreen === tab.id ||
              (activeScreen === "results" && tab.id === "dashboard");
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 gap-1 py-2 transition-all duration-200 ${
                  isActive ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
                data-ocid={tab.ocid}
              >
                <span
                  className={`text-xl leading-none transition-transform duration-200 ${
                    isActive ? "scale-110" : ""
                  }`}
                >
                  {tab.icon}
                </span>
                <span
                  className={`text-xs font-bold leading-none ${
                    isActive ? "opacity-100" : "opacity-60"
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="footer-indicator"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-white"
                    style={{ top: 0 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
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
    <div className="min-h-screen bg-background pt-[70px] pb-20">
      {/* Hero Banner */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #dbeafe 0%, #e0f2fe 40%, #ccfbf1 100%)",
        }}
      >
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

        <div className="max-w-[1000px] mx-auto px-4 py-10 flex flex-col md:flex-row items-center gap-8 relative z-10">
          <motion.div
            className="shrink-0 animate-float"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <img
              src="/assets/generated/math-mascot-transparent.dim_400x400.png"
              alt="MathWhiz mascot"
              className="w-36 h-36 md:w-48 md:h-48 object-contain drop-shadow-xl"
            />
          </motion.div>

          <motion.div
            className="flex-1 text-center md:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p className="text-sm font-bold text-primary uppercase tracking-wider mb-1">
              Welcome Back! 👋
            </p>
            <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight mb-2">
              Ready to <span className="text-primary">Master Math</span>?
            </h1>
            <p className="text-muted-foreground font-semibold mb-1">{msg}</p>
            <div className="flex items-center gap-2 justify-center md:justify-start mb-5 flex-wrap">
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
            <Button
              size="lg"
              className="rounded-full px-8 text-base font-black shadow-lg hover:shadow-xl transition-all hover:scale-105"
              onClick={onStartGame}
              data-ocid="dashboard.play.primary_button"
            >
              <Play className="h-5 w-5 mr-2" /> Start Playing!
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Main content */}
      <main className="max-w-[1000px] mx-auto px-4 py-8 space-y-8">
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
              className={`border-2 ${stat.color}`}
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
          className="bg-white rounded-2xl border-2 border-border p-5"
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

        {/* Difficulty + Today's Challenge */}
        <div className="grid md:grid-cols-3 gap-6">
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <Card className="border-2 border-primary/20 h-full">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-xl">🎮</span>
                  </div>
                  <div>
                    <h2 className="font-black text-lg">Choose Difficulty</h2>
                    <p className="text-sm text-muted-foreground font-semibold">
                      Select and start!
                    </p>
                  </div>
                </div>

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
              className="border-2 border-secondary/30 h-full"
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
                  className={`border-2 transition-all ${earned ? "border-amber-300" : "border-border opacity-50"}`}
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
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8 bg-white">
        <div className="max-w-[1000px] mx-auto px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()}. Built with ❤ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              className="text-primary hover:underline font-semibold"
            >
              caffeine.ai
            </a>
          </p>
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: timer depends on questionIndex reset
  useEffect(() => {
    if (selected !== null) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAnswer(-1);
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
    <div className="min-h-screen bg-background flex flex-col pt-[70px] pb-20">
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
          <motion.div
            className="bg-white rounded-3xl border-2 border-border p-8 mb-6 text-center"
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
            <AnimatePresence>
              {encouragement && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`mt-3 text-lg font-black ${feedback === "correct" ? "text-emerald-600" : "text-red-500"}`}
                >
                  {feedback === "correct" ? "✓ " : "✗ "}
                  {encouragement}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

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
                  "bg-white border-border hover:border-primary hover:bg-primary/5 hover:scale-105 active:scale-95";
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 pt-[70px] pb-20">
      {showConfetti && <ConfettiEffect />}

      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        <Card
          className="border-2 border-border overflow-hidden"
          data-ocid="results.panel"
        >
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
                <div key={stat.label} className="bg-muted rounded-2xl p-3">
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

            <div className="flex gap-3 pt-2">
              <Button
                size="lg"
                className="flex-1 rounded-full font-black"
                onClick={onPlayAgain}
                data-ocid="results.play_again.primary_button"
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Play Again
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 rounded-full font-bold border-2"
                onClick={onGoHome}
                data-ocid="results.home.secondary_button"
              >
                🏠 Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Leaderboard Screen ───────────────────────────────────────────────────────
function LeaderboardScreen() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  const medalColors = [
    "bg-amber-400 text-white shadow-md",
    "bg-slate-300 text-slate-700 shadow-md",
    "bg-amber-600/80 text-white shadow-md",
  ];
  const medalEmojis = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-background pt-[70px] pb-20">
      {/* Header */}
      <div
        className="sticky top-[70px] z-30 border-b border-purple-700/30"
        style={{
          background:
            "linear-gradient(135deg, #dbeafe 0%, #e9d5ff 50%, #fce7f3 100%)",
        }}
      >
        <div className="max-w-[1000px] mx-auto px-4 py-5">
          <h1 className="text-2xl font-black">🏆 Leaderboard</h1>
          <p className="text-sm text-muted-foreground font-semibold mt-0.5">
            Top players by total XP
          </p>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-3" data-ocid="leaderboard.loading_state">
            {["sk1", "sk2", "sk3", "sk4", "sk5"].map((sk) => (
              <div
                key={sk}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl border-2 border-border"
              >
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="flex-1 h-5" />
                <Skeleton className="w-16 h-5" />
              </div>
            ))}
          </div>
        ) : leaderboard && leaderboard.length > 0 ? (
          <div className="space-y-3" data-ocid="leaderboard.list">
            {leaderboard.slice(0, 10).map(([principal, score], i) => (
              <motion.div
                key={principal.toString()}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-2 ${
                  i === 0
                    ? "border-amber-300 bg-amber-50"
                    : i === 1
                      ? "border-slate-300 bg-slate-50"
                      : i === 2
                        ? "border-amber-600/40 bg-orange-50"
                        : "border-border bg-white"
                }`}
                data-ocid={`leaderboard.item.${i + 1}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                    i < 3 ? medalColors[i] : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < 3 ? medalEmojis[i] : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm truncate">
                    {principal.toString().length > 20
                      ? `${principal.toString().slice(0, 10)}…${principal.toString().slice(-6)}`
                      : principal.toString()}
                  </div>
                  {i === 0 && (
                    <span className="text-xs font-bold text-amber-600">
                      👑 Champion
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="font-black text-primary text-sm">
                    {Number(score)} pts
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div
            className="text-center py-16"
            data-ocid="leaderboard.empty_state"
          >
            <Trophy className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <h3 className="font-black text-lg text-foreground mb-1">
              No scores yet!
            </h3>
            <p className="text-muted-foreground font-semibold">
              Be the first to claim the top spot 🚀
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Stats Screen ─────────────────────────────────────────────────────────────
function StatsScreen({ onPlayGame }: { onPlayGame: () => void }) {
  const { data: stats, isLoading } = useGetStats();

  const level = Number(stats?.level ?? 1);
  const totalXp = Number(stats?.totalXp ?? 0);
  const streak = Number(stats?.streak ?? 0);
  const highScore = Number(stats?.highScore ?? 0);
  const badges = stats?.badges ?? [];
  const xpForLevel = level * 100;
  const xpProgress = Math.min(((totalXp % xpForLevel) / xpForLevel) * 100, 100);

  return (
    <div className="min-h-screen bg-background pt-[70px] pb-20">
      {/* Header */}
      <div
        className="sticky top-[70px] z-30 border-b border-blue-200"
        style={{
          background:
            "linear-gradient(135deg, #dbeafe 0%, #e0f2fe 60%, #ccfbf1 100%)",
        }}
      >
        <div className="max-w-[1000px] mx-auto px-4 py-5">
          <h1 className="text-2xl font-black">📊 Your Stats</h1>
          <p className="text-sm text-muted-foreground font-semibold mt-0.5">
            Track your math journey
          </p>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto px-4 py-8 space-y-8">
        {/* Level card */}
        {isLoading ? (
          <div className="space-y-4" data-ocid="stats.loading_state">
            <Skeleton className="h-28 rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            {/* Level + XP */}
            <motion.div
              className="bg-white rounded-2xl border-2 border-primary/20 p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              data-ocid="stats.level.card"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg">
                  L{level}
                </div>
                <div>
                  <h2 className="font-black text-2xl">Level {level}</h2>
                  <p className="text-muted-foreground font-semibold">
                    {totalXp} total XP earned
                  </p>
                </div>
                <div className="ml-auto">
                  <Star className="h-8 w-8 fill-amber-400 text-amber-400" />
                </div>
              </div>
              <div className="mb-2 flex justify-between text-xs font-bold text-muted-foreground">
                <span>XP Progress</span>
                <span>
                  {totalXp % xpForLevel} / {xpForLevel} to Level {level + 1}
                </span>
              </div>
              <Progress value={xpProgress} className="h-4 rounded-full" />
            </motion.div>

            {/* Stats grid */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {[
                {
                  label: "Total XP",
                  value: totalXp,
                  icon: <Zap className="h-6 w-6 text-amber-500" />,
                  color: "bg-amber-50 border-amber-200",
                  ocid: "stats.xp.card",
                },
                {
                  label: "High Score",
                  value: `${highScore}/10`,
                  icon: <Trophy className="h-6 w-6 text-amber-500" />,
                  color: "bg-amber-50 border-amber-200",
                  ocid: "stats.high_score.card",
                },
                {
                  label: "Best Streak",
                  value: `${streak}x`,
                  icon: <Flame className="h-6 w-6 text-red-500" />,
                  color: "bg-red-50 border-red-200",
                  ocid: "stats.streak.card",
                },
                {
                  label: "Badges",
                  value: `${badges.length}/${BADGE_DEFS.length}`,
                  icon: (
                    <Medal
                      className="h-6 w-6"
                      style={{ color: "oklch(0.58 0.22 285)" }}
                    />
                  ),
                  color: "bg-purple-50 border-purple-200",
                  ocid: "stats.badges.card",
                },
              ].map((stat) => (
                <Card
                  key={stat.label}
                  className={`border-2 ${stat.color}`}
                  data-ocid={stat.ocid}
                >
                  <CardContent className="p-4 text-center">
                    <div className="flex justify-center mb-2">{stat.icon}</div>
                    <div className="text-2xl font-black">{stat.value}</div>
                    <div className="text-xs font-semibold text-muted-foreground mt-1">
                      {stat.label}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>

            {/* Badges full list */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <h2 className="font-black text-xl mb-4">🏅 All Badges</h2>
              <div
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
                data-ocid="stats.badges.list"
              >
                {BADGE_DEFS.map((badge, i) => {
                  const earned = badges.some((b) => b.name === badge.name);
                  return (
                    <Card
                      key={badge.id}
                      className={`border-2 transition-all ${
                        earned
                          ? "border-amber-300 bg-amber-50/30"
                          : "border-border opacity-50 grayscale"
                      }`}
                      data-ocid={`stats.badge.item.${i + 1}`}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="text-3xl mb-2">{badge.icon}</div>
                        <div className="font-black text-sm">{badge.name}</div>
                        <div className="text-xs text-muted-foreground font-semibold mt-1">
                          {badge.description}
                        </div>
                        {earned ? (
                          <Badge className="mt-2 text-xs bg-amber-100 text-amber-700">
                            ✓ Earned
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-2 text-xs">
                            Locked
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div
              className="text-center py-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <p className="text-muted-foreground font-semibold mb-4">
                Keep playing to earn more badges and XP!
              </p>
              <Button
                size="lg"
                className="rounded-full px-10 font-black shadow-lg hover:scale-105 transition-all"
                onClick={onPlayGame}
                data-ocid="stats.play.primary_button"
              >
                <Play className="h-5 w-5 mr-2" /> Play to Earn More!
              </Button>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Parents Screen ───────────────────────────────────────────────────────────
function ParentsScreen() {
  const { data: stats, isLoading } = useGetStats();
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [newPinInput, setNewPinInput] = useState("");
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  const level = Number(stats?.level ?? 1);
  const totalXp = Number(stats?.totalXp ?? 0);
  const highScore = Number(stats?.highScore ?? 0);
  const streak = Number(stats?.streak ?? 0);
  const badges = stats?.badges ?? [];

  const currentPin = localStorage.getItem("parentPin") || "1234";

  const handlePinInput = (digit: string) => {
    if (pinError) setPinError(false);
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      setTimeout(() => {
        if (newPin === currentPin) {
          setUnlocked(true);
          setPin("");
        } else {
          setPinError(true);
          setPin("");
        }
      }, 200);
    }
  };

  const handleBackspace = () => {
    if (pinError) setPinError(false);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleLock = () => {
    setUnlocked(false);
    setPin("");
    setPinError(false);
    setNewPinInput("");
    setPinChangeSuccess(false);
  };

  const handleNewPinInput = (digit: string) => {
    if (newPinInput.length >= 4) return;
    const updated = newPinInput + digit;
    setNewPinInput(updated);
    if (updated.length === 4) {
      setTimeout(() => {
        localStorage.setItem("parentPin", updated);
        setNewPinInput("");
        setPinChangeSuccess(true);
        setTimeout(() => setPinChangeSuccess(false), 2000);
      }, 200);
    }
  };

  const handleNewPinBackspace = () => {
    setNewPinInput((prev) => prev.slice(0, -1));
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background pt-[70px] pb-20 flex flex-col">
        {/* Header */}
        <div
          className="sticky top-[70px] z-30 border-b border-pink-200"
          style={{
            background: "linear-gradient(135deg, #fce7f3 0%, #e9d5ff 100%)",
          }}
        >
          <div className="max-w-[1000px] mx-auto px-4 py-5">
            <h1 className="text-2xl font-black">👨‍👩‍👧 Parents</h1>
            <p className="text-sm text-muted-foreground font-semibold mt-0.5">
              PIN protected area
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <motion.div
            className="w-full max-w-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card
              className="border-2 border-border shadow-lg"
              data-ocid="parents.dialog"
            >
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-3">🔒</div>
                  <h2 className="font-black text-xl">Parent Access</h2>
                  <p className="text-sm text-muted-foreground font-semibold mt-1">
                    Enter your 4-digit PIN to continue
                  </p>
                </div>

                {/* PIN dots */}
                <div className="flex justify-center gap-3 mb-6">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        pinError
                          ? "border-red-400 bg-red-300 animate-shake"
                          : pin.length > i
                            ? "border-primary bg-primary"
                            : "border-border bg-white"
                      }`}
                    />
                  ))}
                </div>

                {pinError && (
                  <p
                    className="text-center text-red-500 font-bold text-sm mb-4"
                    data-ocid="parents.error_state"
                  >
                    ❌ Wrong PIN. Try again.
                  </p>
                )}

                {/* Number pad */}
                <div
                  className="grid grid-cols-3 gap-3"
                  data-ocid="parents.input"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      className="h-14 rounded-2xl border-2 border-border bg-white font-black text-xl hover:border-primary hover:bg-primary/5 active:scale-95 transition-all"
                      onClick={() => handlePinInput(String(digit))}
                      data-ocid={"parents.pin.button"}
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="h-14 rounded-2xl border-2 border-border bg-white font-bold text-sm text-muted-foreground hover:border-destructive hover:bg-red-50 active:scale-95 transition-all"
                    onClick={handleBackspace}
                    data-ocid="parents.backspace.button"
                  >
                    ⌫
                  </button>
                  <button
                    type="button"
                    className="h-14 rounded-2xl border-2 border-border bg-white font-black text-xl hover:border-primary hover:bg-primary/5 active:scale-95 transition-all"
                    onClick={() => handlePinInput("0")}
                    data-ocid="parents.pin.button"
                  >
                    0
                  </button>
                  <div />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // Unlocked view
  return (
    <div className="min-h-screen bg-background pt-[70px] pb-20">
      {/* Header */}
      <div
        className="sticky top-[70px] z-30 border-b border-pink-200"
        style={{
          background: "linear-gradient(135deg, #fce7f3 0%, #e9d5ff 100%)",
        }}
      >
        <div className="max-w-[1000px] mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">👨‍👩‍👧 Parents</h1>
            <p className="text-sm text-muted-foreground font-semibold mt-0.5">
              Your child's progress
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full font-bold border-2"
            onClick={handleLock}
            data-ocid="parents.lock.button"
          >
            🔒 Lock
          </Button>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto px-4 py-8 space-y-8">
        {isLoading ? (
          <div className="space-y-4" data-ocid="parents.loading_state">
            <Skeleton className="h-32 rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            {/* Child overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card
                className="border-2 border-pink-200 bg-pink-50/30"
                data-ocid="parents.overview.card"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white font-black text-lg shadow">
                      L{level}
                    </div>
                    <div>
                      <h2 className="font-black text-lg">
                        Your Child's Progress
                      </h2>
                      <div className="flex items-center gap-1 mt-0.5">
                        {["s1", "s2", "s3", "s4", "s5"].map((sk) => (
                          <Star
                            key={sk}
                            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Level", value: level, icon: "⭐" },
                      { label: "Total XP", value: totalXp, icon: "⚡" },
                      {
                        label: "High Score",
                        value: `${highScore}/10`,
                        icon: "🎯",
                      },
                      { label: "Best Streak", value: `${streak}x`, icon: "🔥" },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="bg-white rounded-xl p-3 border border-border text-center"
                      >
                        <div className="text-xl mb-1">{stat.icon}</div>
                        <div className="font-black text-lg">{stat.value}</div>
                        <div className="text-xs text-muted-foreground font-semibold">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Badges earned */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <h2 className="font-black text-xl mb-4">
                🏅 Badges Earned ({badges.length}/{BADGE_DEFS.length})
              </h2>
              <div
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
                data-ocid="parents.badges.list"
              >
                {BADGE_DEFS.map((badge, i) => {
                  const earned = badges.some((b) => b.name === badge.name);
                  return (
                    <Card
                      key={badge.id}
                      className={`border-2 ${earned ? "border-amber-300" : "border-border opacity-50"}`}
                      data-ocid={`parents.badge.item.${i + 1}`}
                    >
                      <CardContent className="p-3 text-center">
                        <div
                          className={`text-2xl mb-1 ${earned ? "" : "grayscale"}`}
                        >
                          {badge.icon}
                        </div>
                        <div className="font-black text-xs">{badge.name}</div>
                        {earned && (
                          <Badge className="mt-1 text-xs bg-amber-100 text-amber-700">
                            ✓
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </motion.div>

            {/* Tips for parents */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <h2 className="font-black text-xl mb-4">💡 Tips for Parents</h2>
              <div className="space-y-3" data-ocid="parents.tips.list">
                {[
                  {
                    tip: "Celebrate every win",
                    detail:
                      "Even small improvements deserve recognition. Positive reinforcement builds confidence and keeps kids motivated to learn.",
                    icon: "🎉",
                  },
                  {
                    tip: "Short sessions are better",
                    detail:
                      "10–15 minutes of focused practice is more effective than hour-long sessions. Keep it fun and stop before frustration sets in.",
                    icon: "⏱️",
                  },
                  {
                    tip: "Connect math to daily life",
                    detail:
                      "Count objects around the house, measure ingredients while cooking, or calculate change at a store. Real-world math sticks!",
                    icon: "🌍",
                  },
                  {
                    tip: "Let them struggle a little",
                    detail:
                      "Productive struggle builds resilience. Give hints rather than answers, and praise the effort, not just the result.",
                    icon: "💪",
                  },
                ].map((item, i) => (
                  <div
                    key={item.tip}
                    className="flex gap-4 p-4 bg-white rounded-2xl border-2 border-border"
                    data-ocid={`parents.tips.item.${i + 1}`}
                  >
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div>
                      <div className="font-black text-sm">{item.tip}</div>
                      <div className="text-sm text-muted-foreground font-semibold mt-0.5">
                        {item.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Change PIN */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card
                className="border-2 border-purple-200 bg-purple-50/30"
                data-ocid="parents.change_pin.card"
              >
                <CardContent className="p-6">
                  <h2 className="font-black text-xl mb-1">🔑 Change PIN</h2>
                  <p className="text-sm text-muted-foreground font-semibold mb-5">
                    Enter a new 4-digit PIN
                  </p>

                  {pinChangeSuccess ? (
                    <div
                      className="flex flex-col items-center py-6 gap-2"
                      data-ocid="parents.change_pin.success_state"
                    >
                      <div className="text-4xl">✅</div>
                      <p className="font-black text-lg text-green-600">
                        PIN updated!
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* New PIN dots */}
                      <div className="flex justify-center gap-3 mb-5">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                              newPinInput.length > i
                                ? "border-purple-500 bg-purple-500"
                                : "border-border bg-white"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Compact number pad */}
                      <div
                        className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto"
                        data-ocid="parents.new_pin.input"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                          <button
                            key={digit}
                            type="button"
                            className="h-11 rounded-xl border-2 border-border bg-white font-black text-lg hover:border-purple-400 hover:bg-purple-50 active:scale-95 transition-all"
                            onClick={() => handleNewPinInput(String(digit))}
                            data-ocid="parents.new_pin.button"
                          >
                            {digit}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="h-11 rounded-xl border-2 border-border bg-white font-bold text-sm text-muted-foreground hover:border-destructive hover:bg-red-50 active:scale-95 transition-all"
                          onClick={handleNewPinBackspace}
                          data-ocid="parents.new_pin_backspace.button"
                        >
                          ⌫
                        </button>
                        <button
                          type="button"
                          className="h-11 rounded-xl border-2 border-border bg-white font-black text-lg hover:border-purple-400 hover:bg-purple-50 active:scale-95 transition-all"
                          onClick={() => handleNewPinInput("0")}
                          data-ocid="parents.new_pin.button"
                        >
                          0
                        </button>
                        <div />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>
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
    sdk.connection("#7c3aed");
  }, []);

  const handleStartGame = () => setScreen("game");
  const handleFinish = (result: GameResult) => {
    setGameResult(result);
    setScreen("results");
  };
  const handlePlayAgain = () => setScreen("game");
  const handleGoHome = () => setScreen("dashboard");

  const handleNavigate = (s: Screen) => {
    if (s === "dashboard") handleGoHome();
    else setScreen(s);
  };

  // Unused variable suppressed
  void walletAddress;

  if (isConnecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 pt-[70px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
          className="w-12 h-12 rounded-full border-4 border-pink-400 border-t-transparent"
        />
        <p className="text-purple-200 font-semibold text-sm">
          Connecting to Metanet...
        </p>
      </div>
    );
  }

  const showFooterNav = screen !== "game";

  return (
    <>
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
        {screen === "leaderboard" && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <LeaderboardScreen />
          </motion.div>
        )}
        {screen === "stats" && (
          <motion.div
            key="stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <StatsScreen onPlayGame={handleStartGame} />
          </motion.div>
        )}
        {screen === "parents" && (
          <motion.div
            key="parents"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ParentsScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {showFooterNav && (
        <FloatingFooterNav activeScreen={screen} onNavigate={handleNavigate} />
      )}

      <Toaster />
    </>
  );
}

export default function App() {
  return <MathApp />;
}
