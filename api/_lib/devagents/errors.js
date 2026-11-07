// A failure the browser is allowed to know about. `code` is one of the plain
// codes in api/devagents.js; nothing else about the failure reaches the client.
export class DevAgentsError extends Error {
  constructor(code, status) {
    super(code);
    this.name = "DevAgentsError";
    this.code = code;
    this.status = status;
  }
}
