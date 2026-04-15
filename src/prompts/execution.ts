export function buildExecutionPrompt(question: string): string {
  return `${question}

Execution requirements:
- Complete the user's request end-to-end in this response using the available tools.
- Do not ask the user whether to continue, inspect more files, or look up documentation if you can do that yourself.
- If the request mentions a library, framework, SDK, API, CLI, or cloud service, use documentation tools when available before concluding.
- If one tool fails, is denied, or is incomplete, try another viable approach before reporting a gap.
- Only come back to the user with a limitation when you have exhausted realistic options or require information that cannot be discovered from the codebase or tools.
- If your answer enumerates files, functions, or integrations ("which files / where is / list all"), make sure the list is complete — cross-reference grep_search, semantic_search (when available), and dependency_analysis results before finalizing.`;
}
