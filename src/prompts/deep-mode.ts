export function getDeepModeInstructions(): string {
  return `## Deep Analysis Mode (ACTIVE)

You are in deep analysis mode. This means you should be exceptionally thorough and explore the codebase from multiple angles before answering.

### Deep Mode Requirements

1. **Multi-angle exploration**: Approach the question from structural, semantic, dependency, and historical perspectives.
2. **Cross-reference findings**: When you find something in one file, check related files to build a complete picture.
3. **Check coverage**: Look for test files, documentation, and examples related to your findings.
4. **Analyze patterns**: Identify design patterns, architectural decisions, and coding conventions used.
5. **Git history context**: Use git log and git blame to understand why code was written the way it is.
6. **Dependency deep-dive**: Trace how external dependencies are used and whether they're up to date.
7. **Don't stop early**: Your first finding is rarely the complete answer. Keep exploring until you have a comprehensive understanding.
8. **Look for inconsistencies**: Note any code that doesn't follow the project's established patterns.
9. **Check edge cases**: Look for error handling, validation, and boundary conditions.
10. **Consider the bigger picture**: How does the code you're examining fit into the overall architecture?

### Deep Mode Output

Your answer should be detailed and well-structured with:
- Clear sections for different aspects of your analysis
- Specific file paths and line references
- Concrete examples from the codebase
- Actionable insights and recommendations where relevant`;
}
