"""Keep school-switch archives in storage and remove the website route to them."""

def transform(source):
    def replace(old, new):
        nonlocal source
        assert source.count(old) == 1, old
        source = source.replace(old, new)

    start = source.index("archives:(s.archives||[]).filter(x=>!x.deletedAt).map")
    end = source.index("}},", start)
    source = source[:start] + "archives:[]" + source[end:]
    replace(
        "[...s.campuses,...(s.archives||[])].find(x=>!x.deletedAt&&same(x.viewerToken||'',key))",
        "s.campuses.find(x=>!x.deletedAt&&same(x.viewerToken||'',key))",
    )
    replace(
        "school.campuses?.find(x=>x.id===(id||school.activeSiteId))||(school.archives||[]).find(x=>!x.deletedAt&&x.archiveId===id)",
        "school.campuses?.find(x=>x.id===(id||school.activeSiteId))",
    )
    replace("version:'2.9.64',recorderWebsiteSession:true", "version:'2.9.76',privateSchoolArchives:true,recorderWebsiteSession:true")
    replace("// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.64", "// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.76")
    return source


if __name__ == '__main__':
    import argparse
    from pathlib import Path
    parser = argparse.ArgumentParser(description='Update the private Rased Schools service from 2.9.64 to 2.9.76.')
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    try:
        upgraded = transform(args.source.read_text(encoding='utf-8'))
    except (AssertionError, ValueError):
        parser.error('Input does not match the expected 2.9.64 Schools service.')
    with args.output.open('x', encoding='utf-8') as output:
        output.write(upgraded)
