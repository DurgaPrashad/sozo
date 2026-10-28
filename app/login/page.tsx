import WorkspaceLogin from "../../components/workspace-login";
import { chatGPTSignInAvailable } from "../chatgpt-auth";
export default function Login() {
  return <WorkspaceLogin chatGPT={chatGPTSignInAvailable} />;
}
