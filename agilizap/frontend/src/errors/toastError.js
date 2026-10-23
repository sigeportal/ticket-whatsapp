import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";
import { isString } from "lodash";

const toastError = err => {
	const errorMsg = err?.response?.data?.error;
	if (errorMsg) {
		if (i18n.exists(`backendErrors.${errorMsg}`)) {
			toast.error(i18n.t(`backendErrors.${errorMsg}`), {
				toastId: errorMsg,
				autoClose: 3500,
			});
			return;
		}
		toast.error(errorMsg, {
			toastId: errorMsg,
			autoClose: 3500,
		});
		return;
	}

	if (isString(err)) {
		toast.error(err, {
			autoClose: 3500,
		});
		return;
	}

	if (err?.message && isString(err.message)) {
		toast.error(err.message, {
			autoClose: 3500,
		});
		return;
	}

	toast.error(i18n.t("backendErrors.unknown") || "Ocorreu um erro!", {
		autoClose: 3500,
	});
};

export default toastError;
