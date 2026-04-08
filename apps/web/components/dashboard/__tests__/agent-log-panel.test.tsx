import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentLogPanel } from '../agent-log-panel';
import { useDashboardStore } from '@/hooks/use-dashboard-store';

describe('AgentLogPanel', () => {
  beforeEach(() => {
    useDashboardStore.getState().reset();
  });

  it('renders empty state when no logs', () => {
    render(<AgentLogPanel />);
    expect(screen.getByText('Sin logs disponibles')).toBeInTheDocument();
  });

  it('renders log entries', () => {
    const store = useDashboardStore.getState();
    store.addLog({
      id: 'log-1',
      agentType: 'dba',
      level: 'info',
      message: 'Creating tables',
      timestamp: new Date().toISOString(),
    });
    store.addLog({
      id: 'log-2',
      agentType: 'backend',
      level: 'ok',
      message: 'Backend complete',
      timestamp: new Date().toISOString(),
    });

    render(<AgentLogPanel />);
    expect(screen.getByText('Creating tables')).toBeInTheDocument();
    expect(screen.getByText('Backend complete')).toBeInTheDocument();
  });

  it('filters logs by agent', async () => {
    const user = userEvent.setup();
    const store = useDashboardStore.getState();
    store.addLog({
      id: 'log-1',
      agentType: 'dba',
      level: 'info',
      message: 'DBA log',
      timestamp: new Date().toISOString(),
    });
    store.addLog({
      id: 'log-2',
      agentType: 'backend',
      level: 'info',
      message: 'Backend log',
      timestamp: new Date().toISOString(),
    });

    render(<AgentLogPanel />);

    // Both visible initially
    expect(screen.getByText('DBA log')).toBeInTheDocument();
    expect(screen.getByText('Backend log')).toBeInTheDocument();

    // Filter to dba
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'dba');

    expect(screen.getByText('DBA log')).toBeInTheDocument();
    expect(screen.queryByText('Backend log')).not.toBeInTheDocument();
  });

  it('shows pause/play toggle', async () => {
    const user = userEvent.setup();
    const store = useDashboardStore.getState();
    store.addLog({
      id: 'log-1',
      agentType: 'dba',
      level: 'info',
      message: 'Test log',
      timestamp: new Date().toISOString(),
    });

    render(<AgentLogPanel />);

    const pauseBtn = screen.getByLabelText(/pausar/i);
    expect(pauseBtn).toBeInTheDocument();

    await user.click(pauseBtn);
    expect(screen.getByLabelText(/reanudar/i)).toBeInTheDocument();
  });
});
