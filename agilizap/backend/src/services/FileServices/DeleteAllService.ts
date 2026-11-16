import Files from "../../models/Files";
import AppError from "../../errors/AppError";

const DeleteAllService = async (companyId: number): Promise<void> => {
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new AppError("ERR_INVALID_COMPANY", 400);
  }

  await Files.destroy({
    where: { companyId }
  });
};

export default DeleteAllService;
