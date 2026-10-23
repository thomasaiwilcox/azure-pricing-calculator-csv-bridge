// Local parsing/serialization only. C# 5 and .NET Framework 4.5 compatible.
// Loaded by Windows PowerShell's built-in Add-Type; no external libraries.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace CalcBridge {
    public sealed class CsvRecord {
        public int Line;
        public string[] Cells;
    }
    public sealed class CsvDocument {
        public string[] Headers;
        public List<CsvRecord> Records = new List<CsvRecord>();
    }
    public static class Formats {
        public static string Utf8(byte[] data) {
            string text = new UTF8Encoding(false, true).GetString(data);
            return text.Length > 0 && text[0] == '\ufeff' ? text.Substring(1) : text;
        }
        public static object Parse(string text) { return new JsonReader(text).Read(); }
        public static string Json(object value, bool sortKeys, bool ascii) {
            StringBuilder result = new StringBuilder();
            WriteJson(result, value, sortKeys, ascii, 0);
            return result.ToString();
        }
        private static void Quote(StringBuilder output, string value, bool ascii) {
            output.Append('"');
            foreach (char c in value) {
                switch (c) {
                    case '"': output.Append("\\\""); break;
                    case '\\': output.Append("\\\\"); break;
                    case '\b': output.Append("\\b"); break;
                    case '\f': output.Append("\\f"); break;
                    case '\n': output.Append("\\n"); break;
                    case '\r': output.Append("\\r"); break;
                    case '\t': output.Append("\\t"); break;
                    default:
                        if (c < 32 || (ascii && c > 126)) output.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                        else output.Append(c);
                        break;
                }
            }
            output.Append('"');
        }
        private static void WriteJson(StringBuilder output, object value, bool sortKeys, bool ascii, int depth) {
            if (depth > 100) throw new FormatException("JSON nesting exceeds the supported limit");
            if (value != null && value.GetType().FullName == "System.Management.Automation.PSObject")
                value = value.GetType().GetProperty("BaseObject").GetValue(value, null);
            if (value == null) { output.Append("null"); return; }
            if (value is string) { Quote(output, (string)value, ascii); return; }
            if (value is bool) { output.Append((bool)value ? "true" : "false"); return; }
            IDictionary map = value as IDictionary;
            if (map != null) {
                List<string> keys = new List<string>();
                foreach (object key in map.Keys) {
                    if (!(key is string)) throw new FormatException("JSON object keys must be strings");
                    keys.Add((string)key);
                }
                if (sortKeys) keys.Sort(StringComparer.Ordinal);
                output.Append('{'); bool first = true;
                foreach (string key in keys) {
                    if (!first) output.Append(','); first = false;
                    Quote(output, key, ascii); output.Append(':'); WriteJson(output, map[key], sortKeys, ascii, depth + 1);
                }
                output.Append('}'); return;
            }
            IEnumerable sequence = value as IEnumerable;
            if (sequence != null) {
                output.Append('['); bool first = true;
                foreach (object item in sequence) {
                    if (!first) output.Append(','); first = false;
                    WriteJson(output, item, sortKeys, ascii, depth + 1);
                }
                output.Append(']'); return;
            }
            if (value is double || value is float) {
                double number = Convert.ToDouble(value, CultureInfo.InvariantCulture);
                if (Double.IsNaN(number) || Double.IsInfinity(number)) throw new FormatException("Non-finite JSON number");
                output.Append(number.ToString("R", CultureInfo.InvariantCulture)); return;
            }
            if (value is decimal || value is byte || value is sbyte || value is short || value is ushort ||
                value is int || value is uint || value is long || value is ulong) {
                output.Append(Convert.ToString(value, CultureInfo.InvariantCulture)); return;
            }
            throw new FormatException("Unsupported JSON value type: " + value.GetType().FullName);
        }
        private sealed class JsonReader {
            private readonly string text;
            private int offset, nodes;
            private static readonly Regex Number = new Regex(@"\G-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?", RegexOptions.CultureInvariant);
            public JsonReader(string value) { text = value; }
            private FormatException Error(string reason) { return new FormatException(reason + " at JSON position " + offset); }
            private void Space() { while (offset < text.Length && (text[offset] == ' ' || text[offset] == '\t' || text[offset] == '\r' || text[offset] == '\n')) offset++; }
            public object Read() {
                object value = Value(0); Space();
                if (offset != text.Length) throw Error("Unexpected trailing content");
                return value;
            }
            private object Value(int depth) {
                if (depth > 100 || ++nodes > 1000000) throw Error("JSON is too large or deeply nested");
                Space(); if (offset == text.Length) throw Error("Expected a JSON value");
                char c = text[offset];
                if (c == '"') return String();
                if (c == '{') {
                    offset++; Space();
                    OrderedDictionary map = new OrderedDictionary(StringComparer.Ordinal);
                    if (offset < text.Length && text[offset] == '}') { offset++; return map; }
                    while (true) {
                        Space(); if (offset == text.Length || text[offset] != '"') throw Error("Expected an object key");
                        string key = String();
                        if (map.Contains(key) || key == "__proto__" || key == "prototype" || key == "constructor") throw Error("Duplicate or unsafe object key");
                        Space(); if (offset == text.Length || text[offset++] != ':') throw Error("Expected a colon");
                        map.Add(key, Value(depth + 1)); Space();
                        if (offset < text.Length && text[offset] == '}') { offset++; return map; }
                        if (offset == text.Length || text[offset++] != ',') throw Error("Expected a comma or closing brace");
                    }
                }
                if (c == '[') {
                    offset++; Space(); List<object> items = new List<object>();
                    if (offset < text.Length && text[offset] == ']') { offset++; return items.ToArray(); }
                    while (true) {
                        items.Add(Value(depth + 1)); Space();
                        if (offset < text.Length && text[offset] == ']') { offset++; return items.ToArray(); }
                        if (offset == text.Length || text[offset++] != ',') throw Error("Expected a comma or closing bracket");
                    }
                }
                foreach (string literal in new string[] { "true", "false", "null" }) {
                    if (offset + literal.Length <= text.Length && System.String.CompareOrdinal(text, offset, literal, 0, literal.Length) == 0) {
                        offset += literal.Length;
                        if (literal == "null") return null;
                        return literal == "true";
                    }
                }
                Match match = Number.Match(text, offset);
                if (!match.Success) throw Error("Expected a valid JSON value");
                offset += match.Length; long integer;
                if (match.Value.IndexOfAny(new char[] { '.', 'e', 'E' }) < 0 && Int64.TryParse(match.Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out integer)) return integer;
                double number;
                if (!Double.TryParse(match.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out number) || Double.IsNaN(number) || Double.IsInfinity(number)) throw Error("Non-finite JSON number");
                return number;
            }
            private string String() {
                offset++; StringBuilder value = new StringBuilder();
                while (offset < text.Length) {
                    char c = text[offset++];
                    if (c == '"') return value.ToString();
                    if (c < 32) throw Error("Control character in string");
                    if (c != '\\') { value.Append(c); continue; }
                    if (offset == text.Length) throw Error("Incomplete string escape");
                    c = text[offset++];
                    switch (c) {
                        case '"': value.Append('"'); break; case '\\': value.Append('\\'); break; case '/': value.Append('/'); break;
                        case 'b': value.Append('\b'); break; case 'f': value.Append('\f'); break; case 'n': value.Append('\n'); break;
                        case 'r': value.Append('\r'); break; case 't': value.Append('\t'); break;
                        case 'u':
                            ushort code;
                            if (offset + 4 > text.Length || !UInt16.TryParse(text.Substring(offset, 4), NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture, out code)) throw Error("Invalid Unicode escape");
                            value.Append((char)code); offset += 4; break;
                        default: throw Error("Invalid string escape");
                    }
                }
                throw Error("Unterminated string");
            }
        }
        public static CsvDocument Csv(byte[] data) {
            string text = Utf8(data); int pos = 0, line = 1;
            CsvDocument document = new CsvDocument();
            if (text.Length == 0) throw new FormatException("CSV is empty");
            CsvRecord header = Record(text, ref pos, ref line);
            document.Headers = header.Cells;
            while (pos < text.Length) {
                CsvRecord row = Record(text, ref pos, ref line);
                if (row.Cells.Length > 0) document.Records.Add(row);
            }
            return document;
        }
        private static CsvRecord Record(string text, ref int pos, ref int line) {
            CsvRecord record = new CsvRecord(); record.Line = line;
            List<string> cells = new List<string>(); bool content = false;
            while (true) {
                StringBuilder field = new StringBuilder();
                if (pos < text.Length && text[pos] == '"') {
                    content = true; pos++; bool closed = false;
                    while (pos < text.Length) {
                        char c = text[pos++];
                        if (c == '"') {
                            if (pos < text.Length && text[pos] == '"') { field.Append('"'); pos++; }
                            else { closed = true; break; }
                        } else {
                            field.Append(c);
                            if (c == '\r') { if (pos < text.Length && text[pos] == '\n') { field.Append('\n'); pos++; } line++; }
                            else if (c == '\n') line++;
                        }
                    }
                    if (!closed) throw new FormatException("CSV row " + record.Line + ": unterminated quoted field");
                    if (pos < text.Length && text[pos] != ',' && text[pos] != '\r' && text[pos] != '\n') throw new FormatException("CSV row " + record.Line + ": unexpected text after closing quote");
                } else {
                    while (pos < text.Length && text[pos] != ',' && text[pos] != '\r' && text[pos] != '\n') { field.Append(text[pos++]); content = true; }
                }
                cells.Add(field.ToString());
                if (pos == text.Length) break;
                char delimiter = text[pos++];
                if (delimiter == ',') { content = true; continue; }
                if (delimiter == '\r' && pos < text.Length && text[pos] == '\n') pos++;
                line++; break;
            }
            record.Cells = content ? cells.ToArray() : new string[0];
            return record;
        }
        public static string CsvLine(string[] fields) {
            StringBuilder result = new StringBuilder();
            for (int i = 0; i < fields.Length; i++) {
                if (i > 0) result.Append(','); string value = fields[i] ?? "";
                if (value.IndexOfAny(new char[] { ',', '"', '\r', '\n' }) >= 0) result.Append('"').Append(value.Replace("\"", "\"\"")).Append('"');
                else result.Append(value);
            }
            return result.Append("\r\n").ToString();
        }
    }
}
