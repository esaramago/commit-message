import * as vscode from 'vscode'
import { GitAPI, GitExtension, GitRepository } from './types'

export async function getGitAPI(): Promise<GitAPI | undefined> {
  const gitExtension =
    vscode.extensions.getExtension<GitExtension>('vscode.git')
  if (!gitExtension) {
    return undefined
  }

  if (!gitExtension.isActive) {
    await gitExtension.activate()
  }

  return gitExtension.exports.getAPI(1)
}

export function getTargetRepository(
  gitAPI: GitAPI,
  sourceControlOrRepo?: any,
): GitRepository | undefined {
  // If the command was triggered from SCM title or item, VS Code passes the repository or SourceControl
  if (sourceControlOrRepo) {
    // Case 1: directly a GitRepository
    if ('inputBox' in sourceControlOrRepo && 'diff' in sourceControlOrRepo) {
      return sourceControlOrRepo as GitRepository
    }
    // Case 2: SourceControl object with rootUri
    if ('rootUri' in sourceControlOrRepo && sourceControlOrRepo.rootUri) {
      const match = gitAPI.repositories.find(
        (r) => r.rootUri.toString() === sourceControlOrRepo.rootUri.toString(),
      )
      if (match) {
        return match
      }
    }
  }

  // Check repositories with active UI focus
  const selectedRepo = gitAPI.repositories.find((r) => r.ui.selected)
  if (selectedRepo) {
    return selectedRepo
  }

  // Check active text editor file matching repository
  const activeEditor = vscode.window.activeTextEditor
  if (activeEditor) {
    const activeUri = activeEditor.document.uri.toString()
    const match = gitAPI.repositories.find((r) =>
      activeUri.startsWith(r.rootUri.toString()),
    )
    if (match) {
      return match
    }
  }

  // Fallback to first repository if available
  return gitAPI.repositories[0]
}

export interface RepositoryDiffResult {
  diff: string
  isStaged: boolean
}

export async function getRepositoryDiff(
  repo: GitRepository,
  includeUnstagedIfNoStaged: boolean,
): Promise<RepositoryDiffResult | undefined> {
  const hasStaged =
    repo.state.indexChanges && repo.state.indexChanges.length > 0

  if (hasStaged) {
    const stagedDiff = await repo.diff(true)
    if (stagedDiff && stagedDiff.trim().length > 0) {
      return { diff: stagedDiff, isStaged: true }
    }
  }

  if (includeUnstagedIfNoStaged) {
    const hasWorkingTree =
      repo.state.workingTreeChanges && repo.state.workingTreeChanges.length > 0
    if (hasWorkingTree) {
      const unstagedDiff = await repo.diff(false)
      if (unstagedDiff && unstagedDiff.trim().length > 0) {
        return { diff: unstagedDiff, isStaged: false }
      }
    }
  }

  return undefined
}
