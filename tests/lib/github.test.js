
import { describe, expect, it } from "vitest";
import { githubUrl } from "../../src/lib/github.js";

describe("githubUrl", () => {
  it("uses the server API when signed in", () => {
    expect(githubUrl("/users/octocat", true)).toBe(
      "/api/github?path=%2Fusers%2Foctocat",
    );
  });

  it("uses the public GitHub API when signed out", () => {
    expect(githubUrl("/users/octocat", false)).toBe(
      "https://api.github.com/users/octocat",
    );
  });

  it("encodes the path when signed in", () => {
    expect(githubUrl("/search/repositories?q=hello world", true)).toBe(
      "/api/github?path=%2Fsearch%2Frepositories%3Fq%3Dhello%20world",
    );
  });
});
