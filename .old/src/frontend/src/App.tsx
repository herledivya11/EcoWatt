import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Gauge,
  LayoutDashboard,
  Leaf,
  Lightbulb,
  Receipt,
  TrendingDown,
  User,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useAddPrediction, useGetAllPredictions } from "./hooks/useQueries";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PredictionResult {
  predictedUnits: number;
  unitsConsumed: number;
  usedMeterReading: boolean;
  energyCharge: number;
  fixedCharge: number;
  electricityDuty: number;
  totalBill: number;
  co2Emissions: number;
  co2Level: "green" | "yellow" | "red";
  baseContribution: number;
  applianceContribution: number;
  usageContribution: number;
  savedUnits: number;
  savedMoney: number;
  savedCarbon: number;
}

type HouseholdType = "Studio" | "Apartment" | "House" | "Villa";
type ActiveSection = "dashboard" | "predict" | "billing" | "carbon" | "account";

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_UNITS: Record<HouseholdType, number> = {
  Studio: 80,
  Apartment: 120,
  House: 180,
  Villa: 260,
};

const TIPS_BY_TYPE: Record<HouseholdType, string[]> = {
  Studio: [
    "Switch to LED bulbs — saves 75% of lighting energy.",
    "Unplug chargers when not in use to eliminate phantom load.",
    "Use a smart power strip to cut standby consumption.",
    "Set your AC to 24°C for optimal efficiency.",
    "Air-dry dishes instead of using the heated drying cycle.",
    "Use natural light during the day and install dimmers.",
  ],
  Apartment: [
    "Seal window gaps to reduce AC/heating load by up to 20%.",
    "Replace your water heater with an energy-efficient model.",
    "Run dishwasher and washing machine during off-peak hours.",
    "Install smart plugs on high-draw appliances.",
    "Switch ceiling fans to energy-star rated models.",
    "Use programmable thermostats for automatic temperature control.",
  ],
  House: [
    "Install solar panels to offset up to 80% of grid usage.",
    "Add roof insulation to reduce heating/cooling by 30%.",
    "Replace HVAC filters monthly for peak efficiency.",
    "Use a solar water heater for domestic hot water.",
    "Install motion sensors in less-used rooms.",
    "Schedule appliance timers for off-peak consumption.",
  ],
  Villa: [
    "Install a solar+battery system for near-zero grid dependency.",
    "Use a building energy management system (BEMS).",
    "Switch pool pumps and garden lights to timers.",
    "Install EV charging on renewable-only circuit.",
    "Upgrade to tri-split inverter ACs in all zones.",
    "Conduct a professional energy audit to identify hotspots.",
  ],
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function getLastSixMonths(): string[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return MONTH_NAMES[d.getMonth()];
  });
}

function generateMonthlyData(currentUnits: number) {
  const months = getLastSixMonths();
  return months.map((month, i) => {
    if (i < 5) {
      const variation = 0.8 + Math.random() * 0.4;
      return {
        month,
        units: round2(currentUnits * variation),
        isPredicted: false,
      };
    }
    return { month, units: round2(currentUnits), isPredicted: true };
  });
}

function calculatePrediction(
  householdType: HouseholdType,
  appliances: number,
  dailyHours: number,
  prevReading: number | null,
  currReading: number | null,
  tariffRate: number,
): PredictionResult {
  const base = BASE_UNITS[householdType];
  const appContrib = appliances * 8;
  const usageContrib = dailyHours * 15;
  const predicted = base + appContrib + usageContrib;

  const usedMeter =
    prevReading !== null && currReading !== null && currReading > prevReading;
  const units = usedMeter ? currReading! - prevReading! : predicted;

  const energyCharge = round2(units * tariffRate);
  const fixedCharge = 130;
  const duty = round2(energyCharge * 0.16);
  const totalBill = round2(energyCharge + fixedCharge + duty);
  const co2 = round2(units * 0.82);
  const co2Level = co2 < 80 ? "green" : co2 < 160 ? "yellow" : "red";

  const savedUnits = round2(units * 0.1);
  const savedMoney = round2(savedUnits * tariffRate * 1.16);
  const savedCarbon = round2(savedUnits * 0.82);

  return {
    predictedUnits: round2(predicted),
    unitsConsumed: round2(units),
    usedMeterReading: usedMeter,
    energyCharge,
    fixedCharge,
    electricityDuty: duty,
    totalBill,
    co2Emissions: co2,
    co2Level,
    baseContribution: base,
    applianceContribution: appContrib,
    usageContribution: usageContrib,
    savedUnits,
    savedMoney,
    savedCarbon,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "blue" | "green" | "yellow" | "red";
}) {
  const accentMap = {
    blue: "text-primary",
    green: "text-eco",
    yellow: "text-warn",
    red: "text-danger",
  };
  const glowMap = {
    blue: "shadow-glow",
    green: "shadow-glow-eco",
    yellow: "",
    red: "",
  };
  const iconBgMap = {
    blue: "bg-primary/10 text-primary",
    green: "bg-eco/10 text-eco",
    yellow: "bg-warn/10 text-warn",
    red: "bg-danger/10 text-danger",
  };
  const a = accent ?? "blue";
  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 flex gap-4 items-start ${
        glowMap[a]
      } transition-shadow hover:shadow-card`}
    >
      <div className={`rounded-lg p-2.5 ${iconBgMap[a]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
          {label}
        </p>
        <p className={`text-2xl font-bold ${accentMap[a]}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

function CarbonGauge({
  co2,
  level,
}: { co2: number; level: "green" | "yellow" | "red" }) {
  // Semicircle gauge: max 300kg on scale
  const maxCo2 = 300;
  const pct = Math.min(co2 / maxCo2, 1);
  // SVG arc
  const r = 70;
  const cx = 100;
  const cy = 90;
  const startAngle = Math.PI;
  const sweep = Math.PI;
  const angle = startAngle + pct * sweep;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(angle);
  const y2 = cy + r * Math.sin(angle);
  const largeArc = pct > 0.5 ? 1 : 0;
  const trackEnd = { x: cx + r * Math.cos(0), y: cy + r * Math.sin(0) };

  const colorMap = { green: "#35C57A", yellow: "#F5C542", red: "#E05050" };
  const labelMap = {
    green: "Eco Friendly",
    yellow: "Moderate Impact",
    red: "High Carbon Impact",
  };
  const color = colorMap[level];

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 110"
        className="w-56"
        role="img"
        aria-label="Carbon emission gauge"
      >
        {/* Track */}
        <path
          d={`M ${x1} ${y1} A ${r} ${r} 0 1 1 ${trackEnd.x} ${trackEnd.y}`}
          fill="none"
          stroke="oklch(0.28 0.025 235)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        {pct > 0 && (
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}
        {/* Center value */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fill="#E8EEF6"
          fontSize="22"
          fontWeight="700"
        >
          {co2.toFixed(1)}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          fill="#93A6B8"
          fontSize="11"
        >
          kg CO₂
        </text>
        {/* Labels */}
        <text x="28" y={cy + 30} fill="#93A6B8" fontSize="9">
          0
        </text>
        <text x="163" y={cy + 30} fill="#93A6B8" fontSize="9">
          300
        </text>
      </svg>
      <div
        className="mt-1 px-3 py-1 rounded-full text-xs font-semibold"
        style={{ background: `${color}22`, color }}
      >
        {labelMap[level]}
      </div>
    </div>
  );
}

// ─── Tooltip customization ────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-card">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p
          key={p.name}
          style={{ color: p.color ?? p.fill }}
          className="font-semibold"
        >
          {p.name}: {p.value} kWh
        </p>
      ))}
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeSection, setActiveSection] =
    useState<ActiveSection>("dashboard");

  // Form state
  const [householdType, setHouseholdType] =
    useState<HouseholdType>("Apartment");
  const [appliances, setAppliances] = useState("8");
  const [dailyHours, setDailyHours] = useState("6");
  const [prevReading, setPrevReading] = useState("");
  const [currReading, setCurrReading] = useState("");
  const [tariffRate, setTariffRate] = useState("5");

  const [result, setResult] = useState<PredictionResult | null>(null);
  const [monthlyData, setMonthlyData] = useState<
    { month: string; units: number; isPredicted: boolean }[]
  >([]);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: predictions } = useGetAllPredictions();
  const addPrediction = useAddPrediction();

  const handlePredict = useCallback(() => {
    const apps = Number.parseInt(appliances) || 0;
    const hours = Number.parseFloat(dailyHours) || 0;
    const prev = prevReading ? Number.parseFloat(prevReading) : null;
    const curr = currReading ? Number.parseFloat(currReading) : null;
    const tariff = Number.parseFloat(tariffRate) || 5;

    const res = calculatePrediction(
      householdType,
      apps,
      hours,
      prev,
      curr,
      tariff,
    );
    setResult(res);
    setMonthlyData(generateMonthlyData(res.unitsConsumed));

    // Save to backend
    addPrediction.mutate(
      {
        applianceCount: BigInt(apps),
        predictedUnits: res.predictedUnits,
        billTotal: res.totalBill,
        householdType,
        co2Emissions: res.co2Emissions,
        timestamp: BigInt(Date.now() * 1000000),
        dailyUsage: hours,
      },
      {
        onSuccess: () => toast.success("Prediction saved to history."),
        onError: () => toast.error("Could not save prediction."),
      },
    );

    setActiveSection("dashboard");
  }, [
    householdType,
    appliances,
    dailyHours,
    prevReading,
    currReading,
    tariffRate,
    addPrediction,
  ]);

  // Use last saved prediction for initial display
  const displayResult = result;

  // Factor chart data
  const factorData = displayResult
    ? [
        {
          name: "Household Base",
          value: displayResult.baseContribution,
          fill: "#2F79D8",
        },
        {
          name: "Appliances",
          value: displayResult.applianceContribution,
          fill: "#9B6DFF",
        },
        {
          name: "Usage Hours",
          value: displayResult.usageContribution,
          fill: "#35C57A",
        },
      ]
    : [
        {
          name: "Household Base",
          value: BASE_UNITS[householdType],
          fill: "#2F79D8",
        },
        {
          name: "Appliances",
          value: (Number.parseInt(appliances) || 0) * 8,
          fill: "#9B6DFF",
        },
        {
          name: "Usage Hours",
          value: (Number.parseFloat(dailyHours) || 0) * 15,
          fill: "#35C57A",
        },
      ];

  const navItems: {
    id: ActiveSection;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard size={18} />,
    },
    { id: "predict", label: "Predict Consumption", icon: <Brain size={18} /> },
    { id: "billing", label: "Smart Billing", icon: <Receipt size={18} /> },
    { id: "carbon", label: "Carbon Analysis", icon: <Leaf size={18} /> },
    { id: "account", label: "Account", icon: <User size={18} /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Toaster theme="dark" />

      {/* ── Sidebar ── */}
      <aside
        className={`${
          sidebarOpen ? "w-56" : "w-16"
        } flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 z-20`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-sidebar-border">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap size={16} className="text-primary" />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-foreground text-base tracking-tight">
              EcoWatt
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1" data-ocid="sidebar.panel">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.id}
              data-ocid={`sidebar.${item.id}.link`}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeSection === item.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="m-3 p-2 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors flex items-center justify-center"
        >
          <ChevronRight
            size={16}
            className={`transition-transform ${sidebarOpen ? "rotate-180" : ""}`}
          />
        </button>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/60 backdrop-blur-sm flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-foreground">
              {navItems.find((n) => n.id === activeSection)?.label}
            </h1>
            <p className="text-xs text-muted-foreground">
              Electricity Consumption Predictor
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="text-xs border-primary/30 text-primary"
            >
              <Activity size={10} className="mr-1" />
              Live
            </Badge>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User size={14} className="text-primary" />
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* ── DASHBOARD ── */}
          {(activeSection === "dashboard" ||
            activeSection === "carbon" ||
            activeSection === "billing") && (
            <div className="space-y-6 animate-fade-in">
              {/* Hero */}
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Good morning, <span className="text-primary">Energy</span>{" "}
                  Manager ⚡
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Monitor, predict, and optimise your electricity consumption.
                </p>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard
                  icon={<Zap size={20} />}
                  label="Current Month Usage"
                  value={
                    displayResult
                      ? `${displayResult.unitsConsumed} kWh`
                      : "— kWh"
                  }
                  sub={
                    displayResult
                      ? `Predicted: ${displayResult.predictedUnits} kWh`
                      : "Run a prediction"
                  }
                  accent="blue"
                />
                <KpiCard
                  icon={<Receipt size={20} />}
                  label="Smart Billing"
                  value={displayResult ? `₹${displayResult.totalBill}` : "—"}
                  sub={
                    displayResult
                      ? `Energy Charge ₹${displayResult.energyCharge}`
                      : "MSEDCL tariff"
                  }
                  accent="green"
                />
                <KpiCard
                  icon={<Leaf size={20} />}
                  label="Carbon Footprint"
                  value={
                    displayResult ? `${displayResult.co2Emissions} kg` : "— kg"
                  }
                  sub={
                    displayResult
                      ? displayResult.co2Level === "green"
                        ? "Eco Friendly"
                        : displayResult.co2Level === "yellow"
                          ? "Moderate Impact"
                          : "High Carbon Impact"
                      : "CO₂ emissions"
                  }
                  accent={
                    displayResult
                      ? displayResult.co2Level === "green"
                        ? "green"
                        : displayResult.co2Level === "yellow"
                          ? "yellow"
                          : "red"
                      : "blue"
                  }
                />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Monthly Usage Chart */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
                  <SectionHeader
                    title="Monthly Electricity Usage"
                    subtitle="Last 5 months + predicted (highlighted)"
                  />
                  {monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart
                        data={monthlyData}
                        margin={{ top: 4, right: 4, bottom: 0, left: -10 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="oklch(0.28 0.025 235)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fill: "#93A6B8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: "#93A6B8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          unit=" kWh"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="units" name="Units" radius={[4, 4, 0, 0]}>
                          {monthlyData.map((entry) => (
                            <Cell
                              key={entry.month}
                              fill={entry.isPredicted ? "#35C57A" : "#2F79D8"}
                              opacity={entry.isPredicted ? 1 : 0.75}
                            />
                          ))}
                        </Bar>
                        <Line
                          type="monotone"
                          dataKey="units"
                          stroke="#2F79D8"
                          strokeWidth={2}
                          dot={false}
                          strokeDasharray="4 2"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div
                      data-ocid="chart.empty_state"
                      className="flex flex-col items-center justify-center h-[220px] text-muted-foreground"
                    >
                      <Activity size={32} className="mb-2 opacity-30" />
                      <p className="text-sm">
                        Run a prediction to see your usage chart
                      </p>
                    </div>
                  )}
                  <div className="flex gap-4 mt-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-3 h-3 rounded-sm bg-[#2F79D8] inline-block" />
                      Historical
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-3 h-3 rounded-sm bg-[#35C57A] inline-block" />
                      Predicted
                    </span>
                  </div>
                </div>

                {/* Carbon Gauge */}
                <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center justify-center">
                  <SectionHeader
                    title="Carbon Impact"
                    subtitle="CO₂ emission gauge"
                  />
                  {displayResult ? (
                    <CarbonGauge
                      co2={displayResult.co2Emissions}
                      level={displayResult.co2Level}
                    />
                  ) : (
                    <div
                      data-ocid="carbon.empty_state"
                      className="flex flex-col items-center text-muted-foreground py-8"
                    >
                      <Gauge size={36} className="mb-2 opacity-30" />
                      <p className="text-sm text-center">
                        Run a prediction to see your carbon gauge
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tariff + Saving row */}
              {activeSection !== "carbon" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Tariff breakdown */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <SectionHeader
                      title="Tariff Breakdown"
                      subtitle="MSEDCL-style bill components"
                    />
                    {displayResult ? (
                      <div className="space-y-3">
                        {[
                          {
                            label: "Energy Charge",
                            value: `₹${displayResult.energyCharge}`,
                            note: `${displayResult.unitsConsumed} kWh × ₹${tariffRate}`,
                          },
                          {
                            label: "Fixed Charge",
                            value: "₹130.00",
                            note: "Monthly fixed",
                          },
                          {
                            label: "Electricity Duty (16%)",
                            value: `₹${displayResult.electricityDuty}`,
                            note: "16% of energy charge",
                          },
                        ].map((row) => (
                          <div
                            key={row.label}
                            className="flex items-center justify-between py-2 border-b border-border/50"
                          >
                            <div>
                              <p className="text-sm text-foreground font-medium">
                                {row.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {row.note}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-foreground">
                              {row.value}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2">
                          <span className="font-bold text-foreground">
                            Total Bill
                          </span>
                          <span className="text-xl font-bold text-primary">
                            ₹{displayResult.totalBill}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div
                        data-ocid="billing.empty_state"
                        className="py-8 text-center text-muted-foreground"
                      >
                        <Receipt
                          size={32}
                          className="mx-auto mb-2 opacity-30"
                        />
                        <p className="text-sm">
                          Run a prediction to see bill breakdown
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Energy Saving */}
                  <div className="rounded-xl border border-border bg-card p-5">
                    <SectionHeader
                      title="Energy Saving Suggestions"
                      subtitle="10% consumption reduction scenario"
                    />
                    {displayResult ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            {
                              icon: <Zap size={16} />,
                              label: "Units Saved",
                              value: `${displayResult.savedUnits} kWh`,
                              color: "text-primary bg-primary/10",
                            },
                            {
                              icon: <TrendingDown size={16} />,
                              label: "Money Saved",
                              value: `₹${displayResult.savedMoney}`,
                              color: "text-eco bg-eco/10",
                            },
                            {
                              icon: <Leaf size={16} />,
                              label: "CO₂ Reduced",
                              value: `${displayResult.savedCarbon} kg`,
                              color: "text-eco bg-eco/10",
                            },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className={`rounded-lg p-3 flex flex-col items-center gap-1 ${item.color}`}
                            >
                              {item.icon}
                              <span className="text-lg font-bold">
                                {item.value}
                              </span>
                              <span className="text-xs opacity-80 text-center leading-tight">
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          By reducing consumption by 10%, you save{" "}
                          <strong className="text-foreground">
                            ₹{displayResult.savedMoney}
                          </strong>{" "}
                          and emit{" "}
                          <strong className="text-foreground">
                            {displayResult.savedCarbon} kg less CO₂
                          </strong>{" "}
                          this month.
                        </p>
                      </div>
                    ) : (
                      <div
                        data-ocid="saving.empty_state"
                        className="py-8 text-center text-muted-foreground"
                      >
                        <TrendingDown
                          size={32}
                          className="mx-auto mb-2 opacity-30"
                        />
                        <p className="text-sm">
                          Run a prediction to see savings
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Explainable AI + Tips row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Factor chart */}
                <div className="rounded-xl border border-border bg-card p-5">
                  <SectionHeader
                    title="Prediction Factors"
                    subtitle="Contribution of each input to predicted units"
                  />
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={factorData}
                      layout="vertical"
                      margin={{ top: 0, right: 24, bottom: 0, left: 80 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="oklch(0.28 0.025 235)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fill: "#93A6B8", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        unit=" kWh"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: "#93A6B8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Units" radius={[0, 4, 4, 0]}>
                        {factorData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* AI Energy Tips */}
                <div className="rounded-xl border border-border bg-card p-5">
                  <SectionHeader
                    title="AI Energy Tips"
                    subtitle={`Tailored for ${householdType} residents`}
                  />
                  <ul className="space-y-2">
                    {TIPS_BY_TYPE[householdType].map((tip) => (
                      <li
                        key={tip.slice(0, 40)}
                        className="flex gap-2.5 items-start text-sm"
                      >
                        <Lightbulb
                          size={14}
                          className="flex-shrink-0 mt-0.5 text-warn"
                        />
                        <span className="text-muted-foreground">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Prediction History */}
              {predictions && predictions.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <SectionHeader
                    title="Prediction History"
                    subtitle="Past predictions from backend"
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {[
                            "Household",
                            "Units",
                            "Bill",
                            "CO₂",
                            "Appliances",
                            "Hours",
                          ].map((h) => (
                            <th
                              key={h}
                              className="text-left py-2 px-3 text-xs text-muted-foreground font-medium"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {predictions
                          .slice(-5)
                          .reverse()
                          .map((p, i) => (
                            <tr
                              key={String(p.timestamp)}
                              data-ocid={`history.item.${i + 1}`}
                              className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                            >
                              <td className="py-2 px-3 font-medium">
                                {p.householdType}
                              </td>
                              <td className="py-2 px-3 text-primary">
                                {p.predictedUnits.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-eco">
                                ₹{p.billTotal.toFixed(2)}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs"
                                  style={{
                                    background:
                                      p.co2Emissions < 80
                                        ? "#35C57A22"
                                        : p.co2Emissions < 160
                                          ? "#F5C54222"
                                          : "#E0505022",
                                    color:
                                      p.co2Emissions < 80
                                        ? "#35C57A"
                                        : p.co2Emissions < 160
                                          ? "#F5C542"
                                          : "#E05050",
                                  }}
                                >
                                  {p.co2Emissions.toFixed(2)} kg
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                {p.applianceCount.toString()}
                              </td>
                              <td className="py-2 px-3">
                                {p.dailyUsage.toFixed(1)}h
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PREDICT FORM ── */}
          {activeSection === "predict" && (
            <div className="max-w-2xl space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  Predict Consumption
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your household details to get an ML-style electricity
                  prediction.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 space-y-5">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Brain size={16} className="text-primary" />
                  Household Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Household type */}
                  <div className="space-y-1.5">
                    <Label htmlFor="household">Household Type</Label>
                    <Select
                      value={householdType}
                      onValueChange={(v) =>
                        setHouseholdType(v as HouseholdType)
                      }
                    >
                      <SelectTrigger
                        id="household"
                        data-ocid="predict.household.select"
                        className="bg-input border-border"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            "Studio",
                            "Apartment",
                            "House",
                            "Villa",
                          ] as HouseholdType[]
                        ).map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Appliances */}
                  <div className="space-y-1.5">
                    <Label htmlFor="appliances">Number of Appliances</Label>
                    <Input
                      id="appliances"
                      data-ocid="predict.appliances.input"
                      type="number"
                      min="0"
                      value={appliances}
                      onChange={(e) => setAppliances(e.target.value)}
                      className="bg-input border-border"
                      placeholder="e.g. 8"
                    />
                  </div>

                  {/* Daily hours */}
                  <div className="space-y-1.5">
                    <Label htmlFor="hours">Daily Usage Hours</Label>
                    <Input
                      id="hours"
                      data-ocid="predict.hours.input"
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={dailyHours}
                      onChange={(e) => setDailyHours(e.target.value)}
                      className="bg-input border-border"
                      placeholder="e.g. 6"
                    />
                  </div>

                  {/* Tariff */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tariff">Tariff Rate (₹/unit)</Label>
                    <Input
                      id="tariff"
                      data-ocid="predict.tariff.input"
                      type="number"
                      min="0"
                      step="0.5"
                      value={tariffRate}
                      onChange={(e) => setTariffRate(e.target.value)}
                      className="bg-input border-border"
                      placeholder="5"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    Optional: Meter Readings
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="prev">Previous Reading (kWh)</Label>
                      <Input
                        id="prev"
                        data-ocid="predict.prev_reading.input"
                        type="number"
                        value={prevReading}
                        onChange={(e) => setPrevReading(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g. 1200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="curr">Current Reading (kWh)</Label>
                      <Input
                        id="curr"
                        data-ocid="predict.curr_reading.input"
                        type="number"
                        value={currReading}
                        onChange={(e) => setCurrReading(e.target.value)}
                        className="bg-input border-border"
                        placeholder="e.g. 1450"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    If meter readings are provided and valid, actual consumption
                    overrides ML prediction.
                  </p>
                </div>

                <Button
                  data-ocid="predict.submit_button"
                  onClick={handlePredict}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={addPrediction.isPending}
                >
                  {addPrediction.isPending ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span> Saving...
                    </>
                  ) : (
                    <>
                      <Brain size={16} className="mr-2" /> Predict & Calculate
                    </>
                  )}
                </Button>
              </div>

              {/* Live preview */}
              {displayResult && (
                <div
                  data-ocid="predict.success_state"
                  className="rounded-xl border border-eco/30 bg-eco/5 p-5 space-y-3"
                >
                  <div className="flex items-center gap-2 text-eco font-semibold">
                    <CheckCircle2 size={16} />
                    Prediction Complete
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        {displayResult.unitsConsumed}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        kWh Consumed
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-eco">
                        ₹{displayResult.totalBill}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total Bill
                      </p>
                    </div>
                    <div>
                      <p
                        className="text-2xl font-bold"
                        style={{
                          color:
                            displayResult.co2Level === "green"
                              ? "#35C57A"
                              : displayResult.co2Level === "yellow"
                                ? "#F5C542"
                                : "#E05050",
                        }}
                      >
                        {displayResult.co2Emissions} kg
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CO₂ Emissions
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection("dashboard")}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View full dashboard <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {activeSection === "account" && (
            <div className="max-w-lg space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Account</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your profile and settings.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                    <User size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      EcoWatt User
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Internet Identity
                    </p>
                  </div>
                </div>
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total Predictions
                    </span>
                    <span className="font-medium">
                      {predictions?.length ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Current Household
                    </span>
                    <span className="font-medium">{householdType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Last Tariff Rate
                    </span>
                    <span className="font-medium">₹{tariffRate}/unit</span>
                  </div>
                </div>
              </div>
              {predictions && predictions.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
                    <AlertTriangle size={14} className="text-warn" /> Average
                    consumption stats
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/30 p-3 text-center">
                      <p className="text-xl font-bold text-primary">
                        {round2(
                          predictions.reduce(
                            (a, b) => a + b.predictedUnits,
                            0,
                          ) / predictions.length,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg kWh</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3 text-center">
                      <p className="text-xl font-bold text-eco">
                        ₹
                        {round2(
                          predictions.reduce((a, b) => a + b.billTotal, 0) /
                            predictions.length,
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg Bill</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>
            © {new Date().getFullYear()} EcoWatt — Electricity Consumption
            Predictor
          </span>
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Built with ❤️ using caffeine.ai
          </a>
        </footer>
      </div>
    </div>
  );
}
