"""Gera design-system/tokens.css a partir de design-system/tokens.json.

Uso (na raiz do projeto): python design-system/tools/build_tokens.py
O tema escuro é o padrão; o claro vem de prefers-color-scheme ou de <html data-theme="light">.
"""
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
tokens = json.loads((RAIZ / "tokens.json").read_text(encoding="utf-8"))

temas = [t["id"] for t in tokens["color"]["themes"]]  # o primeiro é o padrão
cores = tokens["color"]["tokens"] + tokens["shadow"]["tokens"]


def valor(token, tema):
    v = token["value"]
    if isinstance(v, str):
        v = {temas[0]: v}
    v = v.get(tema, v[temas[0]])
    return re.sub(r"\{([a-z0-9-]+)\}", r"var(--\1)", v)


def bloco(tema, recuo):
    return "\n".join(f"{recuo}--{k['name']}: {valor(k, tema)};" for k in cores)


linhas = [
    "/* Gerado por design-system/tools/build_tokens.py a partir de tokens.json. Não edite à mão. */",
    "",
    ":root {",
    f"  color-scheme: {temas[0]};",
    bloco(temas[0], "  "),
    "",
    f"  --font-sans: {tokens['type']['families']['sans']};",
    f"  --font-mono: {tokens['type']['families']['mono']};",
    "",
]
for k in tokens["spacing"]["tokens"] + tokens["radius"]["tokens"]:
    linhas.append(f"  --{k['name']}: {k['value']};")
linhas.append("")
for grupo in tokens["type"]["groups"]:
    familia = "var(--font-mono)" if grupo["family"] == "mono" else "var(--font-sans)"
    for s in grupo["styles"]:
        linhas.append(f"  --{s['name']}: {s['fontWeight']} {s['fontSize']}/{s['lineHeight']} {familia};")
        linhas.append(f"  --{s['name']}-tracking: {s['letterSpacing']};")
linhas += [
    "}",
    "",
    "/* Tema claro pela preferência do sistema, exceto se o escuro foi forçado */",
    "@media (prefers-color-scheme: light) {",
    '  :root:not([data-theme="dark"]) {',
    "    color-scheme: light;",
    bloco("light", "    "),
    "  }",
    "}",
    "",
    "/* Tema claro forçado */",
    ':root[data-theme="light"] {',
    "  color-scheme: light;",
    bloco("light", "  "),
    "}",
    "",
]
(RAIZ / "tokens.css").write_text("\n".join(linhas), encoding="utf-8", newline="\n")
print("tokens.css gerado")
