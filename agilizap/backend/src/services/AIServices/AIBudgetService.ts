import { Op, literal } from "sequelize";
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

  // Se virou o mês, zera o consumo daquele período sem disparar hooks de instância
  if (company.aiBudgetPeriod !== currentPeriod) {
    const [updatedCount] = await Company.update(
      {
        aiBudgetPeriod: currentPeriod,
        aiMonthlySpent: 0,
        aiRequestsCount: 0
      },
      {
        where: {
          id: companyId,
          [Op.or]: [
            { aiBudgetPeriod: { [Op.ne]: currentPeriod } },
            { aiBudgetPeriod: null }
          ]
        }
      }
    );

    if (updatedCount > 0) {
      currentSpent = 0;
      requestsCount = 0;
    } else {
      const refreshed = await Company.findByPk(companyId);
      currentSpent = Number(refreshed?.aiMonthlySpent || 0);
      requestsCount = Number(refreshed?.aiRequestsCount || 0);
    }
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
    const currentPeriod = getCurrentPeriod();
    const safeCost = Number.isFinite(cost) && cost > 0 ? Number(cost) : 0;

    await Company.update(
      {
        aiMonthlySpent: literal(
          `CASE WHEN "aiBudgetPeriod" = '${currentPeriod}' THEN COALESCE("aiMonthlySpent", 0) + ${safeCost} ELSE ${safeCost} END`
        ) as any,
        aiRequestsCount: literal(
          `CASE WHEN "aiBudgetPeriod" = '${currentPeriod}' THEN COALESCE("aiRequestsCount", 0) + 1 ELSE 1 END`
        ) as any,
        aiBudgetPeriod: currentPeriod
      },
      {
        where: { id: companyId }
      }
    );
  } catch (err: any) {
    logger.error(`[AIBudgetService] Erro ao registrar consumo de IA para empresa ${companyId}: ${err?.message || err}`);
  }
};
