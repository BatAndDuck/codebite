import type { EmbeddingModel } from 'ai';
import type { CodebiteConfig } from '../config.js';
import { readFileTool } from './read-file.js';
import { globSearchTool } from './glob-search.js';
import { grepSearchTool } from './grep-search.js';
import { directoryTreeTool } from './directory-tree.js';
import { listDirectoryTool } from './list-directory.js';
import { folderChildrenTool } from './folder-children.js';
import { fileStatsTool } from './file-stats.js';
import { getCwdTool } from './get-cwd.js';
import { shellCommandTool } from './shell-command.js';
import { dependencyAnalysisTool } from './dependency-analysis.js';
import { createWebSearchTool } from './web-search.js';
import { createSemanticSearchTool } from './semantic-search.js';
import { readFileChunkTool } from './read-file-chunk.js';
import { createContext7DocsTool } from './context7-docs.js';
import { createSpawnSubagentsTool } from './spawn-subagents.js';

export function getAllTools(
  config: CodebiteConfig,
  embeddingModel?: EmbeddingModel,
  runSubagent?: (task: string) => Promise<string>
) {
  const tools: Record<string, any> = {
    'read_file': readFileTool,
    'read_file_chunk': readFileChunkTool,
    'glob_search': globSearchTool,
    'grep_search': grepSearchTool,
    'directory_tree': directoryTreeTool,
    'list_directory': listDirectoryTool,
    'folder_children': folderChildrenTool,
    'file_stats': fileStatsTool,
    'get_cwd': getCwdTool,
    'shell_command': shellCommandTool,
    'dependency_analysis': dependencyAnalysisTool,
  };

  if (config.tools.tavilyApiKey) {
    tools['web_search'] = createWebSearchTool(config.tools.tavilyApiKey);
  }

  if (config.tools.context7ApiKey) {
    tools['context7_docs'] = createContext7DocsTool(config.tools.context7ApiKey);
  }

  if (embeddingModel) {
    tools['semantic_search'] = createSemanticSearchTool(embeddingModel);
  }

  if (runSubagent) {
    tools['spawn_subagents'] = createSpawnSubagentsTool(runSubagent);
  }

  return tools;
}
