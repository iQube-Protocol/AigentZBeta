/**
 * MoneyPenny CRM Tasks API Route
 * 
 * Handles task management and claiming
 */

import { NextRequest, NextResponse } from 'next/server';

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'analysis' | 'optimization' | 'monitoring' | 'research';
  priority: 'low' | 'medium' | 'high';
  reward: number;
  currency: string;
  status: 'available' | 'claimed' | 'completed';
  deadline?: string;
  claimedBy?: string;
  claimedAt?: string;
  completedAt?: string;
}

// Mock database (in production, this would use Supabase or another database)
let tasks: Task[] = [
  {
    id: 'task_1',
    title: 'Analyze Cross-Chain Opportunities',
    description: 'Identify and analyze new arbitrage opportunities between Base and Optimism',
    type: 'analysis',
    priority: 'high',
    reward: 100,
    currency: 'Q¢',
    status: 'available',
    deadline: '2024-01-25T23:59:59Z',
  },
  {
    id: 'task_2',
    title: 'Monitor Market Volatility',
    description: 'Track and report on unusual market patterns across all supported chains',
    type: 'monitoring',
    priority: 'medium',
    reward: 50,
    currency: 'Q¢',
    status: 'available',
    deadline: '2024-01-24T23:59:59Z',
  },
  {
    id: 'task_3',
    title: 'Optimize Strategy Parameters',
    description: 'Fine-tune existing trading strategies for better performance',
    type: 'optimization',
    priority: 'high',
    reward: 75,
    currency: 'Q¢',
    status: 'available',
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const agentId = searchParams.get('agentId') || 'moneypenny';

    // Filter tasks based on query parameters
    let filteredTasks = tasks;

    if (status) {
      filteredTasks = filteredTasks.filter(task => task.status === status);
    }

    if (type) {
      filteredTasks = filteredTasks.filter(task => task.type === type);
    }

    // Filter by claimed tasks for specific agent
    if (agentId && agentId !== 'all') {
      filteredTasks = filteredTasks.filter(task => 
        task.claimedBy === agentId || task.status === 'available'
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredTasks,
      total: filteredTasks.length,
    });

  } catch (error) {
    console.error('MoneyPenny CRM tasks API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, taskId, agentId = 'moneypenny', submission } = await request.json();

    const taskIndex = tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const task = tasks[taskIndex];

    switch (action) {
      case 'claim':
        if (task.status !== 'available') {
          return NextResponse.json(
            { error: 'Task is not available for claiming' },
            { status: 400 }
          );
        }

        tasks[taskIndex] = {
          ...task,
          status: 'claimed',
          claimedBy: agentId,
          claimedAt: new Date().toISOString(),
        };

        console.log(`CRM: Task ${taskId} claimed by ${agentId}`);

        return NextResponse.json({
          success: true,
          data: tasks[taskIndex],
          message: 'Task claimed successfully',
        });

      case 'submit':
        if (task.status !== 'claimed' || task.claimedBy !== agentId) {
          return NextResponse.json(
            { error: 'Task must be claimed by you before submission' },
            { status: 400 }
          );
        }

        if (!submission) {
          return NextResponse.json(
            { error: 'Submission data is required' },
            { status: 400 }
          );
        }

        tasks[taskIndex] = {
          ...task,
          status: 'completed',
          completedAt: new Date().toISOString(),
        };

        console.log(`CRM: Task ${taskId} submitted by ${agentId}`);

        return NextResponse.json({
          success: true,
          data: tasks[taskIndex],
          message: 'Task submitted successfully',
        });

      case 'complete':
        // Admin action to mark task as complete and process rewards
        if (task.status !== 'completed') {
          return NextResponse.json(
            { error: 'Task must be submitted first' },
            { status: 400 }
          );
        }

        // Process reward (in production, this would integrate with payment systems)
        console.log(`CRM: Processing ${task.reward} ${task.currency} reward for ${task.claimedBy}`);

        return NextResponse.json({
          success: true,
          data: tasks[taskIndex],
          message: 'Task completed and reward processed',
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('MoneyPenny CRM tasks API error:', error);
    return NextResponse.json(
      { error: 'Failed to process task request' },
      { status: 500 }
    );
  }
}
