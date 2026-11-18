function checkRasedSchoolDrive() {
  var campusId = ''; // إذا ظهر REGISTRY_MATCHES أكبر من 1، ضع القيمة التي بعد siteId= في رابط راصد.
  campusId = campusId.trim().toLowerCase();
  var registry = commercialReadFile_(commercialRoot_(), 'schools-registry.json', null);
  var matches = (registry?.schools || []).filter(function (school) {
    return !school.deletedAt && (!campusId || school.activeSiteId === campusId) &&
      (school.campuses || []).some(function (campus) { return campus.id === school.activeSiteId; });
  });
  if (matches.length !== 1) {
    console.log('REGISTRY_MATCHES=' + matches.length);
    return;
  }

  var school = matches[0];
  var campus = school.campuses.find(function (item) { return item.id === school.activeSiteId; });
  var link = schoolDriveLink_(school.id);
  if (!link || link.revoked) {
    console.log('DRIVE_LINK=' + (!link ? 'MISSING' : 'REVOKED'));
    return;
  }
  console.log('TODAY_STORAGE=' + (schoolDriveUses_(school, monitorToday_()) ? 'GOOGLE_DRIVE' : 'OWNER_DRIVE'));
  var token = link.accessToken;
  if (!token || link.expiresAt < Date.now() + 60000) {
    try {
      var client = schoolDriveConfig_();
      var grant = schoolDriveJsonFetch_('https://oauth2.googleapis.com/token', {
        method: 'post',
        payload: { grant_type:'refresh_token', refresh_token:link.refreshToken, client_id:client.id, client_secret:client.secret }
      }, 'Drive authentication failed');
      token = grant.access_token;
    } catch (error) {
      console.log('DRIVE_LINK=TOKEN_REFRESH_FAILED');
      return;
    }
  }
  if (!token) {
    console.log('DRIVE_LINK=TOKEN_MISSING');
    return;
  }

  function check(id) {
    if (!id) return {state:'MISSING_POINTER'};
    var metadata;
    try {
      metadata = schoolDriveRaw_(token, 'get', 'https://www.googleapis.com/drive/v3/files/' +
        encodeURIComponent(id) + '?fields=id,mimeType,trashed,appProperties,parents,permissions(type,role)');
    } catch (error) {
      return {state:'DRIVE_HTTP_' + (Number(error.httpStatus) || 'UNKNOWN')};
    }
    if (metadata.trashed) return {state:'TRASHED'};
    if (metadata.mimeType !== 'application/vnd.google-apps.folder') return {state:'NOT_A_FOLDER'};
    if (!metadata.appProperties?.mirsadSchool) return {state:'SCHOOL_TAG_MISSING'};
    if (metadata.appProperties.mirsadSchool !== school.id) return {state:'OTHER_SCHOOL'};
    if (!Array.isArray(metadata.permissions)) return {state:'PERMISSIONS_UNAVAILABLE'};
    if (metadata.permissions.some(function (permission) { return permission.type === 'anyone'; })) return {state:'PUBLIC'};
    return {state:'OK',parents:metadata.parents || []};
  }

  var root = check(link.rootId);
  var folder = check(campus.remoteRootId);
  console.log('DRIVE_ROOT=' + root.state);
  console.log('CAMPUS_FOLDER=' + folder.state);
  if (root.state === 'OK' && folder.state === 'OK') {
    var validLocation = campus.legacy ? campus.remoteRootId === link.rootId : folder.parents.includes(link.rootId);
    console.log('CAMPUS_LOCATION=' + (validLocation ? 'OK' : 'OUTSIDE_REGISTERED_ROOT'));
  }
}
