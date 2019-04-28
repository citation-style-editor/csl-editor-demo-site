"use strict";

// Provides information about the CSL styles repository

define(['src/urlUtils', 'src/debug'], function (CSLEDIT_urlUtils, debug) {
	var cache = {},

	// This is the style to load in the Visual Editor on first run,
	// or if the settings are reset
	defaultStyleId = 'http://www.zotero.org/styles/apa';

	// A list of popular styles obtained from some Mendeley data provided
	// by Carles Pina
	var topStyles = [
		'http://www.zotero.org/styles/apa',
		'http://www.zotero.org/styles/ieee',
		'http://www.zotero.org/styles/harvard1',
		'http://www.zotero.org/styles/nature',
		'http://www.zotero.org/styles/american-medical-association', /* manually updated from styles/ama */
		'http://www.zotero.org/styles/chicago-author-date',
		'http://www.zotero.org/styles/american-political-science-association',
		'http://www.zotero.org/styles/vancouver',
		'http://www.zotero.org/styles/american-sociological-association',
		'http://www.zotero.org/styles/modern-language-association',
		'http://www.zotero.org/styles/modern-humanities-research-association',
		'http://www.zotero.org/styles/chicago-fullnote-bibliography',
		'http://www.zotero.org/styles/associacao-brasileira-de-normas-tecnicas', /* manually updated from styles/abnt */
		'http://www.zotero.org/styles/chicago-note-bibliography',
		'http://www.zotero.org/styles/national-library-of-medicine', /* manually updated from styles/nlm */
		'http://www.zotero.org/styles/american-chemical-society',
		'http://www.zotero.org/styles/cell',
		'http://www.zotero.org/styles/science',
		'http://www.zotero.org/styles/elsevier-with-titles',
		'http://www.zotero.org/styles/ecology',
		'http://www.zotero.org/styles/elsevier-harvard',
		'http://www.zotero.org/styles/royal-society-of-chemistry',
		'http://www.zotero.org/styles/journal-of-the-american-chemical-society',
		'http://www.zotero.org/styles/pnas'
	];

	var getJSONData = function (path) {
		var url;

		if (!(path in cache)) {
			url = CSLEDIT_urlUtils.getResourceUrl(path);
			$.ajax({
				url : url,
				dataType : "json",
				async : false,
				success : function (data) {
					debug.log("fetched json: " + path);
					cache[path] = data;
				},
				error : function () {
							debug.log("WARNING: error fetching " + url);
						},
				cache : true
			});
		}
		return cache[path];
	};

	// Returns a normalised style for use in the generated style ID and filename
	//
	// Tries to match the current practice used in the CSL style repository as
	// best it can, despite the repo styles not being completely consistent
	//
	// See the 'style id generation' test in test_cslStyles.js
	//
	// TODO: jshint reports unsafe characters in the following, use better method of
	//       converting unicode characters to ASCII, may help to normalise the unicode
	//       in the pre-generated JSON data first, but needs investigation
	var getNormalisedStyleTitle = function (styleTitle) {
		return styleTitle
			.replace(/&/g, "and")
			.replace(/\([A-Z]*\)/g, "") // remove upper case text (acronyms) in parentheses
			.replace(/\([^\(]*\)$/, "") //remove content between last set of parentheses
			.replace(/\[[^\[]*\]$/, "") //remove content between last set of square parentheses
			.replace(/[\(\)\[\]]/g, "") // remove other parentheses
			.replace(/[,'\.]/g, "")     // remove other chars
			.replace(/[\\\/:"*?<>\| ]+/g, "-")
			.replace(/--+/g, "-")
			.replace(/-$/, "")
			.toLowerCase()
			.replace(/[àáäâ]|Ã£|Ã¡|Ã /g, "a")
			.replace(/[èéëê]|Ã©|Ã¨/g, "e")
			.replace(/[ìíïî]/g, "i")
			.replace(/[òóöô]/g, "o")
			.replace(/[ùúüû]/g, "u")
			.replace(/[ñ]/g, "n")
			.replace(/[ç]|Ã§/g, "c");
	};

	// Returns a style ID based on the given styleTitle that attempts
	// to fit with the convention used in the CSL styles repository
	var generateStyleId = function (styleTitle) {
		return "http://www.zotero.org/styles/" + getNormalisedStyleTitle(styleTitle);
	};

	// Returns the URL of the style with the given styleId on this server
	var localURLFromZoteroId = function (styleId) {
		var baseUrl = "external/csl-styles/";
		if (styles().masterIdFromId[styleId] !== styleId) {
			baseUrl += "dependent/";
		}

		return CSLEDIT_urlUtils.getResourceUrl(
			styleId.replace("http://www.zotero.org/styles/", baseUrl) + ".csl");
	};

	// This fetches the CSL code for the given styleId
	var fetchCslCode = function (styleId, success, error, async /* optional */) {
		var localURL = localURLFromZoteroId(styleId);

		if (typeof(async) === "undefined") {
			async = true;
		}

		$.ajax({
			url : localURL,
			dataType : "text",
			success : success,
			error : error,
			async : async
		});
	};

	// Returns an object containing information on all styles in the repository:
	//
	// - styleTitleFromId - A map of style ID to style title
	// - masterIdFromId   - A map of style ID to it's master style ID
	//                      (Note: Master styles will point to themselves)
	var styles = function () {
		return getJSONData('generated/cslStyles.json');
	};

	// Returns an object with the following property:
	//
	// - exampleCitationsFromMasterId - A map of master style ID to a list of
	//                                  pre-generated example citations and bibliographies
	var exampleCitations = function () {
		return getJSONData('generated/preGeneratedExampleCitations.json');
	};

	// Returns the URL of the default style on this server
	var defaultStyleURL = function () {
		return localURLFromZoteroId(defaultStyleId);
	};

	return {
		styles : styles,
		exampleCitations : exampleCitations,
		defaultStyleId : defaultStyleId,
		defaultStyleURL : defaultStyleURL,
		generateStyleId : generateStyleId,
		fetchCslCode : fetchCslCode,
		localURLFromZoteroId : localURLFromZoteroId,
		topStyles : topStyles
	};
});
