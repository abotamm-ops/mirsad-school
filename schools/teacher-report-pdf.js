"use strict";

(() => {
  'use strict';

  let _value;
  async function _value2() {
    if (!_value) _value = (async () => {
      const _value3 = await MirsadTeacherReport.fontBytes();
      let _text = "";
      for (let _number = 0; _number < _value3.length; _number += 8192) _text += String.fromCharCode(..._value3.subarray(_number, _number + 8192));
      return btoa(_text);
    })()["catch"](_argument => {
      _value = null;
      throw _argument;
    });
    return _value;
  }
  async function _value4(_argument2, _argument3 = "") {
    const _value5 = MirsadTeacherReport.layout,
      _value6 = MirsadTeacherReport.paragraphs(_argument2),
      _value7 = globalThis.MirsadDirectorSignature?.["get"]() || "",
      _value8 = await _value2();
    if (!globalThis.jspdf?.["jsPDF"]) throw new Error("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0623\u062F\u0627\u0629 PDF\u061B \u062D\u062F\u0651\u062B \u0627\u0644\u0635\u0641\u062D\u0629 \u0648\u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629");
    const _value9 = new jspdf.jsPDF({
      "orientation": "portrait",
      "unit": "mm",
      "format": "a4",
      "compress": true
    });
    _value9.addFileToVFS("MirsadArabic.ttf", _value8), _value9.addFont("MirsadArabic.ttf", "MirsadArabic", "normal"), _value9.setFont("MirsadArabic"), _value9.setLanguage("ar-SA"), _value9.setR2L(false), _value9.setProperties({
      "title": "\u0637\u0644\u0628 \u0625\u0641\u0627\u062F\u0629",
      "author": "",
      "subject": "\u0637\u0644\u0628 \u0625\u0641\u0627\u062F\u0629 \u064A\u0648\u0645\u064A",
      "creator": "\u0631\u0627\u0635\u062F"
    });
    const _value0 = MirsadTeacherReportTemplate["word/media/image1.png"].base64;
    let _value1 = _value5.top + 4;
    function _value10() {
      _value9.setTextColor(25, 45, 55), _value9.setFontSize(10);
      const _items = ["\u0627\u0644\u0645\u0645\u0644\u0643\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629", "\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062A\u0639\u0644\u064A\u0645", globalThis.MirsadSchoolProfile?.["educationAdministration"] || "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629 \u0644\u0644\u062A\u0639\u0644\u064A\u0645", (_argument3 || "").replace(/[.:…]+/g, "")];
      let _number2 = 13;
      for (const _value11 of _items) {
        const _value12 = _value9.splitTextToSize(_value11, 64);
        _value9.text(_value12, 195, _number2, {
          "align": "right"
        }), _number2 += _value12.length * 4.5;
      }
      _value9.addImage("data:image/png;base64," + _value0, "PNG", 89, 10, 32, 25), _value9.setFontSize(10), _value9.text("\u0627\u0644\u062A\u0627\u0631\u064A\u062E " + _argument2.date, 79, 13, {
        "align": "right"
      }), _value9.text("\u0627\u0644\u0631\u0642\u0645", 79, 17.5, {
        "align": "right"
      }), _value9.setDrawColor(165, 182, 190), _value9.setLineWidth(0.25), _value9.line(15, 43, 195, 43);
    }
    function _value13(_argument4) {
      if (_value7 && _argument4.directorSignature) return [];
      _value9.setFontSize(_argument4.bold ? _value5.titleFont : _value5.bodyFont);
      const _value14 = _value9.splitTextToSize(_argument4.value, 180);
      return _value14.length ? _value14 : [""];
    }
    function _value15(_argument5) {
      return (_argument5.spaceBefore || 0) + _value13(_argument5).length * _value5.lineHeight + (_argument5.spaceAfter ?? (_argument5.bold ? _value5.boldGap : _value5.paragraphGap)) + (_value7 && _argument5.directorSignature ? 16.4 : 0);
    }
    function _value16() {
      _value9.addPage(), _value10(), _value1 = _value5.top + 4;
    }
    _value10();
    for (let _number3 = 0; _number3 < _value6.length; _number3++) {
      const _value17 = _value6[_number3];
      if (_value17.bold || _value17.keepNext) {
        let _number4 = 0;
        for (let _value18 = _number3; _value18 < _value6.length; _value18++) {
          _number4 += _value15(_value6[_value18]);
          if (!_value6[_value18].bold && !_value6[_value18].keepNext) break;
        }
        if (_number4 <= 279 - (_value5.top + 4) && _value1 + _number4 > 279) _value16();
      }
      if (_value1 + (_value17.spaceBefore || 0) + _value5.lineHeight > 279) _value16();
      _value1 += _value17.spaceBefore || 0;
      const _value19 = _value13(_value17);
      for (const _value20 of _value19) {
        if (_value1 > 279) _value16();
        _value9.setTextColor(20, 25, 30), _value9.setLineWidth(0.06), _value9.text(_value20, _value17.align === "center" ? 105 : _value17.align === "left" ? 15 : 195, _value1, {
          "align": _value17.align === "center" ? "center" : _value17.align === "left" ? "left" : "right",
          "renderingMode": _value17.bold ? "fillThenStroke" : "fill"
        }), _value1 += _value5.lineHeight;
      }
      if (_value7 && _value17.directorSignature) {
        if (_value1 + 16.4 > 279) _value16();
        _value9.addImage(_value7, "PNG", 81, _value1 - 2, 48, 14.4), _value1 += 16.4;
      }
      _value1 += _value17.spaceAfter ?? (_value17.bold ? _value5.boldGap : _value5.paragraphGap);
    }
    const _value21 = _value9.getNumberOfPages();
    for (let _number5 = 1; _number5 <= _value21; _number5++) {
      _value9.setPage(_number5), _value9.setFontSize(9), _value9.setTextColor(95, 110, 120), _value9.text("\u0631\u0627\u0635\u062F", 105, 290, {
        "align": "center"
      });
    }
    return new Uint8Array(_value9.output("arraybuffer"));
  }
  async function _value22(_argument6, _argument7) {
    const _value23 = await _value4(_argument6, _argument7),
      _value24 = URL.createObjectURL(new Blob([_value23], {
        "type": "application/pdf"
      })),
      _value25 = document.createElement("a");
    _value25.href = _value24, _value25.download = "\u0645\u0633\u0627\u0621\u0644\u0629 \u064A\u0648\u0645 - " + _argument6.name.replace(/[\\/:*?"<>|]/g, "") + " - " + _argument6.date + ".pdf", document.body.append(_value25), _value25.click(), _value25.remove(), setTimeout(() => URL.revokeObjectURL(_value24), 60000);
  }
  globalThis.MirsadTeacherReportPdf = {
    "download": _value22,
    "documentBytes": _value4
  };
})();