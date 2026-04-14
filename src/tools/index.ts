import type { EmbeddingModel } from 'ai';
import type { CodebiteConfig } from '../config.js';
import { readFileTool } from './read-file.js';
import { globSearchTool } from './glob-search.js';
import { grepSearchTool } from './grep-search.js';
import { directoryTreeTool } from './directory-tree.js';
import { listDirectoryTool } from './list-directory.js';
import { fileStatsTool } from './file-stats.js';
import { getCwdTool } from './get-cwd.js';
import { shellCommandTool } from './shell-command.js';
import { dependencyAnalysisTool } from './dependency-analysis.js';
import { createWebSearchTool } from './web-search.js';
import { createSemanticSearchTool } from './semantic-search.js';

export function getAllTools(
  config: CodebiteConfig,
  embeddingModel?: EmbeddingModel
) {
  const tools: Record<string, any> = {
    'read_file': readFileTool,
    'glob_search': globSearchTool,
    'grep_search': grepSearchTool,
    'directory_tree': directoryTreeTool,
    'list_directory': listDirectoryTool,
    'file_stats': fileStatsTool,
    'get_cwd': getCwdTool,
    'shell_command': shellCommandTool,
    'dependency_analysis': dependencyAnalysisTool,
  };

  if (config.tavilyApiKey) {
    tools['web_search'] = createWebSearchTool(config.tavilyApiKey);
  }

  if (embeddingModel) {
    tools['semantic_search'] = createSemanticSearchTool(embeddingModel);
  }

  return tools;
}
