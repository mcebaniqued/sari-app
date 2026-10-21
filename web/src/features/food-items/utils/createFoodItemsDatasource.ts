import { foodItemQuerySchema } from "@sari/contracts";
import type { IDatasource } from "ag-grid-community";

import { listFoodItems } from "../api/foodItemsApi";

/** Destroying an obsolete datasource aborts every request and rejects late callbacks. */
export function createFoodItemsDatasource(
  search: string,
  handlers: {
    setLoading: (value: boolean) => void;
    setError: (value: string) => void;
    setTotal: (value: number) => void;
    onError: (error: unknown) => void;
  },
): IDatasource {
  const { setLoading, setError, setTotal, onError } = handlers;

  const controllers = new Set<AbortController>();
  let active = true;

  return {
    getRows(params) {
      const controller = new AbortController();
      controllers.add(controller);
      setLoading(true);
      setError("");
      void (async () => {
        try {
          const filters: unknown = params.filterModel;
          const query = foodItemQuerySchema.parse({
            start: params.startRow,
            limit: params.endRow - params.startRow,
            search,
            sort: params.sortModel.map(({ colId, sort }) => ({ colId, sort })),
            filters,
          });
          const response = await listFoodItems(query, controller.signal);
          if (!active || controller.signal.aborted) {
            return;
          }

          params.successCallback(response.items, response.total);
          setTotal(response.total);
        } catch (cause) {
          if (!active || controller.signal.aborted) {
            return;
          }

          params.failCallback();
          onError(cause);
        } finally {
          controllers.delete(controller);
          if (active && !controller.signal.aborted) {
            setLoading(controllers.size > 0);
          }
        }
      })();
    },
    destroy() {
      active = false;

      for (const controller of controllers) {
        controller.abort();
      }

      controllers.clear();
    },
  };
}
