// frontend/src/admin/dashboard/goals/api/dashboardGoalsApi.js

import api from '../../../../lib/api';

const DASHBOARD_GOAL_ENDPOINT = '/api/admin/dashboard-goal';

function unwrapDashboardGoalResponse(response) {
  if (response?.data?.data) {
    return response.data.data;
  }

  return response?.data;
}

export async function getDashboardGoal(params = {}) {
  const response = await api.get(DASHBOARD_GOAL_ENDPOINT, { params });
  return unwrapDashboardGoalResponse(response);
}

export async function updateDashboardGoal(payload = {}) {
  const response = await api.put(DASHBOARD_GOAL_ENDPOINT, payload);
  return unwrapDashboardGoalResponse(response);
}

export default {
  getDashboardGoal,
  updateDashboardGoal,
};
