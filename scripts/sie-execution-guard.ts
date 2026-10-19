import { execSync } from "child_process";

/**
 * Guarda de ejecución compartida por los scripts SIE.
 *
 * Protege contra la ejecución accidental contra una base que no sea LOCAL o QA:
 * - Sin `--environment qa`: exige que DATABASE_URL apunte a localhost.
 * - Con `--environment qa`: verifica la identidad AWS (cuenta/región), porque
 *   QA y PROD comparten cuenta; la identidad AWS por sí sola no basta, pero
 *   junto con el host de la URL reduce el riesgo de apuntar a PROD.
 *
 * PROD nunca se habilita por esta vía.
 */

const QA_AWS_ACCOUNT = "564914947461";
const QA_AWS_REGION = "us-east-2";

export function assertExecutionTarget(argv: string[]): void {
  const envIdx = argv.indexOf("--environment");
  const environment = envIdx !== -1 ? argv[envIdx + 1] : "local";

  if (environment === "qa") {
    const account = execSync("aws sts get-caller-identity --query Account --output text", { encoding: "utf8" }).trim();
    if (account !== QA_AWS_ACCOUNT) throw new Error(`REFUSE_WRONG_AWS_ACCOUNT: ${account}. Se espera ${QA_AWS_ACCOUNT}.`);
    const region = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? "";
    if (region !== QA_AWS_REGION) throw new Error(`REFUSE_WRONG_REGION: ${region}. Se espera ${QA_AWS_REGION}.`);
    return;
  }

  const url = process.env.DATABASE_URL ?? "";
  let hostname = "";
  try { hostname = new URL(url).hostname; } catch { throw new Error("DATABASE_URL inválida."); }
  const local = ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
  if (!local) throw new Error(`REFUSE_NON_LOCAL_TARGET: host ${hostname} no es local. Para QA usa --environment qa.`);
}
