import ErrorPage from "@/components/ErrorPage/ErrorPage";

export default function NotFoundPage() {
  return (
    <ErrorPage
      title="Page not found"
      description="This page doesn’t exist. Check the address and try again."
    />
  );
}
