import { describe, expect, it } from "vitest";
import { setupHint } from "../../api/_lib/readme.js";

describe("setupHint", () => {
  it("takes the setup section, without the next section", () => {
    const md = "# Tool\n\nIntro text.\n\n## Installation\n\nRun this:\n\n```bash\npip install tool\n```\n\n## Usage\n\nUse it.";
    expect(setupHint(md)).toEqual({ heading: "Installation", text: "Run this:\n\npip install tool" });
  });

  it("prefers setup over usage, whatever the order", () => {
    const md = "## Usage\n\nuse\n\n## Getting started\n\nclone it";
    expect(setupHint(md)).toEqual({ heading: "Getting started", text: "clone it" });
  });

  it("keeps link text, and drops images, badges and HTML", () => {
    const md = "## Setup\n\n![badge](https://x.test/b.svg) See [the docs](https://x.test).\n<img src=x onerror=alert(1)>\nDone.";
    expect(setupHint(md).text).toBe("See the docs.\n\nDone.");
  });

  it("keeps subsections inside the setup section", () => {
    const md = "## Development\n\nStart:\n\n### Requirements\n\nNode 20\n\n## License\n\nMIT";
    expect(setupHint(md).text).toBe("Start:\n\nRequirements\n\nNode 20");
  });

  it("stays short, ending at a whole line", () => {
    const md = `## Install\n\n${Array.from({ length: 80 }, (_, i) => `line number ${i}`).join("\n")}`;
    const { text } = setupHint(md);
    expect(text.length).toBeLessThanOrEqual(600);
    expect(text.endsWith("…")).toBe(true);
    expect(text.split("\n").slice(0, -1).every((line) => /^line number \d+$/.test(line))).toBe(true);
  });

  it("returns null when there's no setup section, or it's empty", () => {
    expect(setupHint("# Tool\n\nJust words.")).toBeNull();
    expect(setupHint("## Install\n\n## Next")).toBeNull();
    expect(setupHint("")).toBeNull();
    expect(setupHint(null)).toBeNull();
  });
});
