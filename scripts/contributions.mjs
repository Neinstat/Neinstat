// Draws dist/contributions.svg: the last year's contribution total and calendar,
// in the profile's peach + blue palette. Needs GITHUB_TOKEN; user from GITHUB_USER.
import { mkdirSync, writeFileSync } from "node:fs";

const user = process.env.GITHUB_USER || "Neinstat";
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is not set");

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: user } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors || json));
const cal = json.data.user.contributionsCollection.contributionCalendar;

const colors = {
  bg: "#0d1117",
  text: "#c9d1d9",
  muted: "#8b949e",
  peach: "#f4b6a6",
  levels: ["#161b22", "#27427a", "#2f63d6", "#79a8ff", "#f4b6a6"],
};
const max = Math.max(1, ...cal.weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount)));
const level = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));

const cell = 12, gap = 3, step = cell + gap;
const left = 36, top = 70;
const width = left + cal.weeks.length * step + 16;
const height = top + 7 * step + 34;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let cells = "", labels = "", lastMonth = -1;
cal.weeks.forEach((week, x) => {
  const first = week.contributionDays[0];
  const m = new Date(first.date + "T00:00:00Z").getUTCMonth();
  if (m !== lastMonth && x < cal.weeks.length - 1) {
    if (lastMonth !== -1 || new Date(first.date + "T00:00:00Z").getUTCDate() <= 7) {
      labels += `<text x="${left + x * step}" y="${top - 8}" class="m">${months[m]}</text>`;
    }
    lastMonth = m;
  }
  week.contributionDays.forEach((day) => {
    const y = new Date(day.date + "T00:00:00Z").getUTCDay();
    const s = day.contributionCount === 1 ? "" : "s";
    cells += `<rect x="${left + x * step}" y="${top + y * step}" width="${cell}" height="${cell}" rx="3" fill="${colors.levels[level(day.contributionCount)]}"><title>${day.contributionCount} contribution${s} on ${day.date}</title></rect>`;
  });
});
const days = ["", "Mon", "", "Wed", "", "Fri", ""]
  .map((d, i) => (d ? `<text x="0" y="${top + i * step + 10}" class="m">${d}</text>` : ""))
  .join("");
const legendX = width - 16 - 5 * step - 70;
const legend =
  `<text x="${legendX}" y="${height - 12}" class="m">Less</text>` +
  colors.levels.map((c, i) => `<rect x="${legendX + 30 + i * step}" y="${height - 22}" width="${cell}" height="${cell}" rx="3" fill="${c}"/>`).join("") +
  `<text x="${legendX + 30 + 5 * step + 4}" y="${height - 12}" class="m">More</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>
  text { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  .t { font-size: 20px; font-weight: 700; fill: ${colors.peach}; }
  .s { font-size: 13px; fill: ${colors.muted}; }
  .m { font-size: 10px; fill: ${colors.muted}; }
</style>
<rect width="100%" height="100%" rx="10" fill="${colors.bg}"/>
<text x="${left}" y="30" class="t">${cal.totalContributions.toLocaleString("en-US")} contributions in the last year</text>
<text x="${left}" y="48" class="s">Updated ${new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC"}</text>
${labels}${days}${cells}${legend}
</svg>
`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/contributions.svg", svg);
console.log(`Wrote dist/contributions.svg (${cal.totalContributions} contributions)`);
