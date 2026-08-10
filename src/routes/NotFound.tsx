import { Button, Result } from "antd";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <Result
      status="404"
      title="404"
      subTitle="This page does not exist."
      extra={
        <Link to="/documents">
          <Button type="primary">Back to documents</Button>
        </Link>
      }
    />
  );
}
