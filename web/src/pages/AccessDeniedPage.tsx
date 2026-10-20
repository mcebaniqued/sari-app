import ErrorPage from "@/components/ErrorPage/ErrorPage";

export default function AccessDeniedPage() {
  return (
    <ErrorPage
      title="Access denied"
      description="You don’t have permission to view this page or complete this action."
    />
  );
}
