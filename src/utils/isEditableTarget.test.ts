import { describe, expect, it } from "vitest";
import { isEditableTarget } from "./isEditableTarget";

describe("isEditableTarget", () => {
  describe("text-entry <input> types", () => {
    const textInputTypes = [
      "text",
      "search",
      "email",
      "url",
      "tel",
      "password",
      "number",
      "date",
      "datetime-local",
      "month",
      "week",
      "time",
    ];

    it.each(textInputTypes)(
      'returns true for <input type="%s">',
      (inputType) => {
        const input = document.createElement("input");
        input.setAttribute("type", inputType);
        expect(isEditableTarget(input)).toBe(true);
      },
    );

    it("returns true for <input> without a type attribute", () => {
      const input = document.createElement("input");
      expect(isEditableTarget(input)).toBe(true);
    });

    it("returns true for <input> with an unknown type attribute", () => {
      const input = document.createElement("input");
      input.setAttribute("type", "unknown-custom-type");
      expect(isEditableTarget(input)).toBe(true);
    });

    it("returns true for uppercase text-entry type attribute", () => {
      const input = document.createElement("input");
      input.setAttribute("type", "EMAIL");
      expect(isEditableTarget(input)).toBe(true);
    });

    it("returns true for readonly text input (documented behavior)", () => {
      const input = document.createElement("input");
      input.setAttribute("type", "text");
      input.readOnly = true;
      expect(isEditableTarget(input)).toBe(true);
    });
  });

  describe("non-text <input> types", () => {
    const nonTextInputTypes = [
      "checkbox",
      "radio",
      "button",
      "submit",
      "reset",
      "range",
      "color",
      "file",
      "image",
      "hidden",
    ];

    it.each(nonTextInputTypes)(
      'returns false for <input type="%s">',
      (inputType) => {
        const input = document.createElement("input");
        input.setAttribute("type", inputType);
        expect(isEditableTarget(input)).toBe(false);
      },
    );

    it("returns false for uppercase non-text type attribute", () => {
      const input = document.createElement("input");
      input.setAttribute("type", "CHECKBOX");
      expect(isEditableTarget(input)).toBe(false);
    });
  });

  describe("<textarea> and <select>", () => {
    it("returns true for <textarea>", () => {
      const textarea = document.createElement("textarea");
      expect(isEditableTarget(textarea)).toBe(true);
    });

    it("returns true for <select>", () => {
      const select = document.createElement("select");
      expect(isEditableTarget(select)).toBe(true);
    });
  });

  describe("contenteditable elements", () => {
    it('returns true for element with contenteditable="true"', () => {
      const div = document.createElement("div");
      div.setAttribute("contenteditable", "true");
      expect(isEditableTarget(div)).toBe(true);
    });

    it("returns true for element with empty contenteditable attribute", () => {
      const div = document.createElement("div");
      div.setAttribute("contenteditable", "");
      expect(isEditableTarget(div)).toBe(true);
    });

    it('returns true for element with contenteditable="plaintext-only"', () => {
      const div = document.createElement("div");
      div.setAttribute("contenteditable", "plaintext-only");
      expect(isEditableTarget(div)).toBe(true);
    });

    it('returns false for element with contenteditable="false"', () => {
      const div = document.createElement("div");
      div.setAttribute("contenteditable", "false");
      expect(isEditableTarget(div)).toBe(false);
    });

    it("returns true for a nested element inside a contenteditable container", () => {
      const container = document.createElement("div");
      container.setAttribute("contenteditable", "true");
      const child = document.createElement("span");
      container.appendChild(child);
      expect(isEditableTarget(child)).toBe(true);
    });

    it('returns false for a nested element inside contenteditable="false" within a contenteditable container', () => {
      const container = document.createElement("div");
      container.setAttribute("contenteditable", "true");
      const nonEditable = document.createElement("div");
      nonEditable.setAttribute("contenteditable", "false");
      const child = document.createElement("span");
      nonEditable.appendChild(child);
      container.appendChild(nonEditable);
      expect(isEditableTarget(child)).toBe(false);
    });
  });

  describe("non-editable, null, and non-HTMLElement targets", () => {
    it("returns false for null", () => {
      expect(isEditableTarget(null)).toBe(false);
    });

    it("returns false for window and document", () => {
      expect(isEditableTarget(window)).toBe(false);
      expect(isEditableTarget(document)).toBe(false);
    });

    it("returns false for a Text node", () => {
      const textNode = document.createTextNode("hello");
      expect(isEditableTarget(textNode)).toBe(false);
    });

    it("returns false for an SVGElement", () => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      expect(isEditableTarget(svg)).toBe(false);
    });

    it("returns false for regular HTML elements like <div> and <button>", () => {
      expect(isEditableTarget(document.createElement("div"))).toBe(false);
      expect(isEditableTarget(document.createElement("button"))).toBe(false);
    });
  });
});
