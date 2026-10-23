import Company from "../../models/Company";
import { logger } from "../../utils/logger";

export interface AIBudgetCheckResult {
  allowed: boolean;
  reason?: string;
  currentSpent: number;
  limit?: number | null;
  requestsCount: number;
}

const getCurrentPeriod = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const checkCompanyAIBudget = async (
  companyId: number,
  estimatedCost: number = 0.01
): Promise<AIBudgetCheckResult> => {
  const company = await Company.findByPk(companyId);
  if (!company) {
    return {
      allowed: false,
      reason: "COMPANY_NOT_FOUND",
      currentSpent: 0,
      requestsCount: 0
    };
  }

  const currentPeriod = getCurrentPeriod();
  let currentSpent = Number(company.aiMonthlySpent || 0);
  let requestsCount = Number(company.aiRequestsCount || 0);

  // Se virou o mês, zera o consumo daquele período
  if (company.aiBudgetPeriod !== currentPeriod) {
    await company.update({
      aiBudgetPeriod: currentPeriod,
      aiMonthlySpent: 0,
      aiRequestsCount: 0
    });
    currentSpent = 0;
    requestsCount = 0;
  }

  const limit = company.aiMonthlyBudgetLimit !== null && company.aiMonthlyBudgetLimit !== undefined
    ? Number(company.aiMonthlyBudgetLimit)
    : 50.0;

  // Se o teto mensal está configurado e o gasto acumulado + margem da chamada atual exceder o limite
  if (limit !== null && limit > 0) {
    if (currentSpent + estimatedCost > limit) {
      logger.warn(
        `[AIBudgetService] Teto mensal de IA excedido para a empresa ${companyId}. Gasto: R$ ${currentSpent.toFixed(2)}, Limite: R$ ${limit.toFixed(2)}`
      );
      return {
        allowed: false,
        reason: "MONTHLY_BUDGET_EXCEEDED",
        currentSpent,
        limit,
        requestsCount
      };
    }
  }

  return {
    allowed: true,
    currentSpent,
    limit,
    requestsCount
  };
};

export const recordAIUsage = async (
  companyId: number,
  cost: number,
  _tokens?: number
): Promise<void> => {
  try {
    const company = await Company.findByPk(companyId);
    if (!company) return;

    const currentPeriod = getCurrentPeriod();
    let currentSpent = Number(company.aiMonthlySpent || 0);
    let requestsCount = Number(company.aiRequestsCount || 0);

    if (company.aiBudgetPeriod !== currentPeriod) {
      currentSpent = 0;
      requestsCount = 0;
    }

    await company.update({
      aiBudgetPeriod: currentPeriod,
      aiMonthlySpent: currentSpent + Math.max(cost, 0),
      aiRequestsCount: requestsCount + 1
    });
  } catch (err: any) {
    logger.error(`[AIBudgetService] Erro ao registrar consumo de IA para empresa ${companyId}: ${err?.message || err}`);
  }
};
