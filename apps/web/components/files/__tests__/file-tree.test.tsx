import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileTree } from '../file-tree';
import type { FileTreeNodeData } from '@/lib/file-tree-builder';

const MOCK_TREE: FileTreeNodeData[] = [
  {
    id: 'dir-src',
    name: 'src',
    type: 'directory',
    children: [
      {
        id: 'f1',
        name: 'index.ts',
        type: 'file',
        extension: '.ts',
        sizeBytes: 1024,
        agentType: 'backend-agent',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'f2',
        name: 'utils.ts',
        type: 'file',
        extension: '.ts',
        sizeBytes: 512,
        agentType: 'backend-agent',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
  },
  {
    id: 'f3',
    name: 'package.json',
    type: 'file',
    extension: '.json',
    sizeBytes: 2048,
    agentType: 'dba-agent',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('FileTree', () => {
  it('renders file tree with directories and files', () => {
    render(
      <FileTree
        tree={MOCK_TREE}
        totalFiles={3}
        totalSizeBytes={3584}
        selectedFileId={null}
        onSelectFile={vi.fn()}
      />,
    );

    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('utils.ts')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();
  });

  it('shows total files count and size', () => {
    render(
      <FileTree
        tree={MOCK_TREE}
        totalFiles={3}
        totalSizeBytes={3584}
        selectedFileId={null}
        onSelectFile={vi.fn()}
      />,
    );

    expect(screen.getByText(/3 archivos/)).toBeInTheDocument();
    expect(screen.getByText(/3\.5 KB/)).toBeInTheDocument();
  });

  it('calls onSelectFile when clicking a file', async () => {
    const onSelectFile = vi.fn();
    const user = userEvent.setup();

    render(
      <FileTree
        tree={MOCK_TREE}
        totalFiles={3}
        totalSizeBytes={3584}
        selectedFileId={null}
        onSelectFile={onSelectFile}
      />,
    );

    await user.click(screen.getByText('package.json'));
    expect(onSelectFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'f3', name: 'package.json' }),
    );
  });

  it('collapses and expands directories', async () => {
    const user = userEvent.setup();

    render(
      <FileTree
        tree={MOCK_TREE}
        totalFiles={3}
        totalSizeBytes={3584}
        selectedFileId={null}
        onSelectFile={vi.fn()}
      />,
    );

    // Files visible initially (tree expanded by default)
    expect(screen.getByText('index.ts')).toBeInTheDocument();

    // Click directory to collapse
    await user.click(screen.getByText('src'));
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();

    // Click again to expand
    await user.click(screen.getByText('src'));
    expect(screen.getByText('index.ts')).toBeInTheDocument();
  });

  it('filters files by search query', async () => {
    const user = userEvent.setup();

    render(
      <FileTree
        tree={MOCK_TREE}
        totalFiles={3}
        totalSizeBytes={3584}
        selectedFileId={null}
        onSelectFile={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Buscar archivos...');
    await user.type(searchInput, 'utils');

    expect(screen.getByText('utils.ts')).toBeInTheDocument();
    expect(screen.queryByText('package.json')).not.toBeInTheDocument();
  });

  it('shows empty state when no files', () => {
    render(
      <FileTree
        tree={[]}
        totalFiles={0}
        totalSizeBytes={0}
        selectedFileId={null}
        onSelectFile={vi.fn()}
      />,
    );

    expect(screen.getByText('Sin archivos generados')).toBeInTheDocument();
  });

  it('highlights selected file', () => {
    render(
      <FileTree
        tree={MOCK_TREE}
        totalFiles={3}
        totalSizeBytes={3584}
        selectedFileId="f1"
        onSelectFile={vi.fn()}
      />,
    );

    const selectedButton = screen.getByText('index.ts').closest('button');
    expect(selectedButton?.className).toContain('bg-[rgba(var(--accent-rgb)/0.20)]');
  });
});
