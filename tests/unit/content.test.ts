import { describe, expect, it } from "vitest";
import { excerpt, parseBody, parseInline } from "@/lib/content/format";
import { checkSensitive } from "@/lib/content/sensitive-check";

describe("Sicheres Textformat", () => {
  it("erzeugt Überschriften, Absätze und Listen", () => {
    const blocks = parseBody("## Titel\nZeile eins\nZeile zwei\n\n- a\n- b");
    expect(blocks.map((b) => b.type)).toEqual(["h", "p", "ul"]);
  });
  it("interpretiert HTML nicht, sondern behandelt es als Text", () => {
    const inl = parseInline('<script>alert(1)</script> <img src=x onerror="x">');
    expect(inl.every((i) => i.t === "text")).toBe(true);
    expect(inl.map((i) => i.v).join("")).toContain("<script>");
  });
  it("erkennt nur http(s)-Links, keine javascript:-Links", () => {
    expect(parseInline("siehe https://example.org/a.pdf.").find((i) => i.t === "link")?.v).toBe("https://example.org/a.pdf");
    expect(parseInline("javascript:alert(1)").some((i) => i.t === "link")).toBe(false);
  });
  it("kürzt Anreißer", () => {
    expect(excerpt("**Hallo** Welt", 100)).toBe("Hallo Welt");
    expect(excerpt("x".repeat(300), 50)).toHaveLength(50);
  });
});

describe("Warnung vor sensiblen Inhalten", () => {
  it("erkennt E-Mail, Telefonnummer und Gesundheitsdaten", () => {
    const w = checkSensitive("Herr M. (max@firma.de, 0171 1234567) ist krankgeschrieben.");
    const kinds = w.map((x) => x.kind);
    expect(kinds).toContain("email");
    expect(kinds).toContain("phone");
    expect(w.some((x) => x.label === "Gesundheitsdaten")).toBe(true);
  });
  it("erkennt Abmahnungen und gremiumsinterne Hinweise", () => {
    expect(checkSensitive("Die Abmahnung von Frau K.").length).toBeGreaterThan(0);
    expect(checkSensitive("Nur für das Gremium bestimmt").length).toBeGreaterThan(0);
  });
  it("bleibt bei normalen Mitteilungen still", () => {
    expect(checkSensitive("Die Betriebsversammlung findet am 12. März um 10 Uhr in der Kantine statt.")).toEqual([]);
  });
});
