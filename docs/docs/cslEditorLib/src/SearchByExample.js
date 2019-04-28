"use strict";

// Creates a Search by Example page

define(
		[	'src/options',
			'src/exampleData',
			'src/uiConfig',
			'src/xmlUtility',
			'src/diff',
			'src/searchResults',
			'src/cslStyles',
			'src/urlUtils',
			'src/RichTextEditor',
			'src/mustache',
			'src/debug',
			'external/xregexp',
			'jquery.ui'
		],
		function (
			CSLEDIT_options,
			CSLEDIT_exampleData,
			CSLEDIT_uiConfig,
			CSLEDIT_xmlUtility,
			CSLEDIT_diff,
			CSLEDIT_searchResults,
			CSLEDIT_cslStyles,
			CSLEDIT_urlUtils,
			CSLEDIT_RichTextEditor,
			CSLEDIT_mustache,
			debug,
			XRegExp,
			jquery_ui
		) {
	// Creates a Search by Example page within mainContainer
	var CSLEDIT_SearchByExample = function (
			mainContainer,       // the selector or jQuery element to create the search tool within
			configurationOptions // see full list of options at
			                     // https://github.com/citation-style-editor/csl-editor/wiki/Search-By-Example
			) {
		var nameSearchTimeout,
			styleFormatSearchTimeout,
			exampleIndex = -1,
			defaultStyle = CSLEDIT_cslStyles.defaultStyleId,
			tolerance = 50,
			userCitations,
			userBibliographies,
			inputControlsElement,

			citationEditor,
			bibliographyEditor,

			oldCitation = "",
			oldBibliography = "",
			formChangedTimeout,
			exampleCitationsFromMasterId = CSLEDIT_cslStyles.exampleCitations().exampleCitationsFromMasterId,
			referencesToSearch = [];

		CSLEDIT_options.setOptions(configurationOptions);
		mainContainer = $(mainContainer);
		$.ajax({
			url: CSLEDIT_urlUtils.getResourceUrl("html/searchByExample.html"),
			success : function (data) {
				mainContainer.html(data);
				init();
			},
			error : function (jaXHR, textStatus, errorThrown) {
				alert("Couldn't fetch page: " + textStatus);
			},
			cache : false
		});

		var setSelectedControl = function (selected) {
			if (selected === "citation") {
				inputControlsElement.addClass("citationSelected");
				inputControlsElement.removeClass("bibliographySelected");
			} else {
				debug.assertEqual(selected, "bibliography");
				inputControlsElement.removeClass("citationSelected");
				inputControlsElement.addClass("bibliographySelected");
			}
			clearTimeout(formChangedTimeout);
			formChangedTimeout = setTimeout(formChanged, 50);
		};
		var getSelectedControl = function () {
			if (inputControlsElement.hasClass("citationSelected")) {
				return "citation";
			} 
			debug.assert(inputControlsElement.hasClass("bibliographySelected"));
			return "bibliography";
		};

		// used to display HTML tags for debugging
		var escapeHTML = function (string) {
			return $('<pre/>').text(string).html();
		};

		var calculateMatchQualities = function (referenceIndex, matchQualities /* optional */) {
			var userCitation = userCitations[referenceIndex],
				userBibliography = userBibliographies[referenceIndex];

			matchQualities = matchQualities || {};

			$.each(exampleCitationsFromMasterId, function (styleId, exampleCitations) {
				var exampleCitation = exampleCitations[referenceIndex];

				if (exampleCitation !== null && exampleCitation.statusMessage === "") {
					var formattedCitation = exampleCitation.formattedCitations[0];
					var cleanFormattedBibliography =
						CSLEDIT_xmlUtility.cleanInput(exampleCitation.formattedBibliography);

					var citationMatchQuality = 0;
					if (userCitation !== "") {
						citationMatchQuality = CSLEDIT_diff.matchQuality(
							userCitation, formattedCitation);
					}

					var bibliographyMatchQuality = 0;
					if (userBibliography !== "") {
						bibliographyMatchQuality = CSLEDIT_diff.matchQuality(
							userBibliography, cleanFormattedBibliography);
					}

					var thisMatchQuality = 0;
					if (perCharacterOrdering()) {
						thisMatchQuality += citationMatchQuality *
							Math.max(userCitation.length, formattedCitation.length);
						thisMatchQuality += bibliographyMatchQuality *
							Math.max(userBibliography.length, cleanFormattedBibliography.length);
					}
					else {
						thisMatchQuality += citationMatchQuality;
						thisMatchQuality += bibliographyMatchQuality;
					}

					// give tiny boost to top popular styles
					if (CSLEDIT_cslStyles.topStyles.indexOf(styleId) !== -1) {
						thisMatchQuality += 0.1;
					}

					if (thisMatchQuality > tolerance)
					{
						if (styleId in matchQualities) {
							matchQualities[styleId] += thisMatchQuality;
						} else {
							matchQualities[styleId] = thisMatchQuality;
						}
					}
				}
			});
		};

		var searchForStyle = function () {
			var result = [],
				matchQualities = [],
				citationMatchQuality,
				bibliographyMatchQuality,
				index = 0,
				styleId,
				exampleCitation,
				formattedCitation,
				thisMatchQuality,
				cleanFormattedBibliography;

			userCitations[exampleIndex] = citationEditor.value();
			userBibliographies[exampleIndex] = bibliographyEditor.value();

			debug.time("searchForStyle");

			if (!advancedMode()) {
				referencesToSearch = [];
				referencesToSearch[exampleIndex] = true;
			}

			matchQualities = {};
			// search all relevant citations
			$.each(referencesToSearch, function (referenceIndex, toSearch) {
				if (toSearch === true) {
					console.log("searching based on reference " + referenceIndex);
					calculateMatchQualities(referenceIndex, matchQualities);
				}
			});

			var matchQualityList = [];
			$.each(matchQualities, function (styleId, matchQuality) {
				matchQualityList.push({
					styleId : styleId,
					matchQuality : matchQuality / referencesToSearch.length
				});
			});

			matchQualityList.sort(function (a, b) {return b.matchQuality - a.matchQuality; });

			// top results
			$.each(matchQualityList, function (i, matchQuality) {
				result.push({
					styleId : matchQuality.styleId,
					masterId : matchQuality.styleId,
					userCitation : citationEditor.value(),
					userBibliography : bibliographyEditor.value(),
					matchQuality : Math.min(1, matchQuality.matchQuality)
				});
			});
			
			CSLEDIT_searchResults.displaySearchResults(result, $("#searchResults"), exampleIndex);
			debug.timeEnd("searchForStyle");
		};

		var perCharacterOrdering = function () {
			return $('#alternateSearch').is(":checked");
		};

		var personString = function (authors) {
			var result = [],
				index = 0;

			if (typeof(authors) === "undefined") {
				return "No authors";
			}

			for (index = 0; index < authors.length; index++) {
				result.push(authors[index].given + " " + authors[index].family);
			}
			return result.join(", ");
		};

		var tagMatches = function (string, matches) {
			var from = null,
				to = null,
				result = "";

			var getTagged = function () {
				return $('<div/>').append($('<mark/>)').text(string.substring(from, to + 1))).html();
			};

			$.each(string, function (i, char) {
				if (from === null) {
					if (matches[i]) {
						from = i;
						to = i;
					} else {
						// TODO: could be optimised if needed
						result += char;
					}
				} else {
					if (matches[i]) {
						to = i;
					} else if (char === " " && matches[i + 1]) {
						to = i + 1;
					} else {
						result += getTagged();
						result += char;
						from = null;
					}
				}
			});

			if (from !== null) {
				result += getTagged();
			}

			return result;
		};

		var formatExampleDocument = function (userInput) {
			var jsonDocument = CSLEDIT_exampleData.jsonDocumentList[exampleIndex],
				fieldsNotToPartialMatch = ["abstract"],
				userWords,
				elideLimit = 500,
				outputData = {};
			
			if (typeof(userInput) !== "undefined") {
				userWords = userInput.toLowerCase().split(XRegExp('\\P{L}', 'g'));
				userWords.sort(function (a, b) { return b.length - a.length; });
			}

			outputData.fields = [];
			$.each(jsonDocument, function (key, value) {
				var order = CSLEDIT_uiConfig.fieldOrder.indexOf(key),
					valueString,
					valueStringLower,
					newValueString,
					matchingChars = [];

				if (order === -1) {
					order = CSLEDIT_uiConfig.fieldOrder.length;
				}

				if (key === "author" || key === "editor" || key === "translator") {
					valueString = personString(value);
				} else if (key === "issued" || key === "accessed") {
					valueString = value["date-parts"][0].join("/");
				} else if (typeof(value) === "object") {
					valueString = JSON.stringify(value);
				} else {
					valueString = value;
				}
				
				if (valueString.length > elideLimit) {
					valueString = valueString.substring(0, elideLimit) + "...";
				}

				if (valueString === "") {
					// skip empty field
					return true;
				} else if (typeof(userWords) !== "undefined")  {
					// check for a complete match
					if (new RegExp(valueString, "i").test(userInput)) {
						// All chars match
						$.each(valueString, function (i, char) {
							matchingChars[i] = true;
						});
					} else if (fieldsNotToPartialMatch.indexOf(key) === -1) {
						valueStringLower = valueString.toLowerCase();
						// highlight matches
						$.each(userWords, function (i, word) {
							var index,
								index2;

							if (word.length > 2) {
								index = valueStringLower.indexOf(word);
								while (index !== -1) {
									for (index2 = index; index2 < index + word.length; index2++) {
										matchingChars[index2] = true;
									}
									index = valueStringLower.indexOf(word, index + 1);
								}
							}
						});
					}
				}
			
				valueString = tagMatches(valueString, matchingChars);

				outputData.fields.push({
					key: CSLEDIT_uiConfig.capitaliseFirstLetter(key),
					value: valueString,
					order: order
				});
			});

			outputData.fields.sort(function (a, b) {return a.order - b.order; });

			$("#exampleDocument").html(CSLEDIT_mustache.toHtml("exampleMetadata", outputData));

			if (advancedMode()) {
				if (referencesToSearch[exampleIndex] === true) {
					$('#includeReference').prop("checked", true);
				} else {
					$('#includeReference').prop("checked", false);
				}
			}
		};

		var hasChanged = function () {
			var newCitation = citationEditor.value();
			var newBibliography = bibliographyEditor.value();

			if (newCitation !== oldCitation || newBibliography !== oldBibliography) {
				return true;
			} else {
				return false;
			}
		};

		var formChanged = function () {
			var userInput,
				words;

			if (hasChanged()) {
				$("#searchResults").html("<i>Click search to find similar styles</i>");
			}

			if (getSelectedControl() === "citation") {
				userInput = citationEditor.value();
			} else {
				userInput = bibliographyEditor.value();
			}
			
			formatExampleDocument(userInput);
		};

		var search = function () {
			var userCitation,
				userBibliography,
				timeout = 10;

			$("#styleFormatResult").html("<i>Searching...</i>");

			oldCitation = citationEditor.value();
			oldBibliography = bibliographyEditor.value();

			$("#searchResults").html("<p><emp>Searching for styles...</emp></p>");

			styleFormatSearchTimeout = setTimeout(searchForStyle, timeout);
		};

		var updateExample = function (newExampleIndex, initialising) {
			var length = exampleCitationsFromMasterId[defaultStyle].length;

			if (exampleIndex !== -1) {
				userCitations[exampleIndex] = citationEditor.value();
				userBibliographies[exampleIndex] = bibliographyEditor.value();
			}

			exampleIndex = (newExampleIndex + length) % length;

			formatExampleDocument();

			citationEditor.value(userCitations[exampleIndex]);
			bibliographyEditor.value(userBibliographies[exampleIndex]);
			
			if (initialising !== true) {
				formChanged();
			}
		};

		// Use advanced mode, with extra controls for power users
		// Accessible via ?advanced=true query string
		var advancedMode = function () {
			return CSLEDIT_urlUtils.getUrlVar("advanced") === "true";
		};

		var init = function () {
			inputControlsElement = $('#styleFormatInputControls');

			if (exampleCitationsFromMasterId[defaultStyle].length !==
					CSLEDIT_exampleData.jsonDocumentList.length) {
				alert("Example citations need re-calculating on server");
			}

			$("#inputTabs").tabs({
				show: function (event, ui) {
					if (ui.panel.id === "styleNameInput") {
						$("#styleNameResult").show();
						$("#styleFormatResult").hide();
					} else {
						$("#styleNameResult").hide();
						$("#styleFormatResult").show();
					}
				}
			});

			citationEditor = new CSLEDIT_RichTextEditor($("#userCitation"), function () {
				setSelectedControl("citation");
			});
			bibliographyEditor = new CSLEDIT_RichTextEditor($("#userBibliography"), function () {
				setSelectedControl("bibliography");
			});

			$('#searchButton').on("click", search);

			// prepopulate with example	citations
			userCitations = [];
			userBibliographies = [];
			$.each(exampleCitationsFromMasterId[defaultStyle],
					function (i, exampleCitation) {
				userCitations.push(exampleCitation.formattedCitations[0]);
				userBibliographies.push(exampleCitation.formattedBibliography);
			});

			updateExample(0, true);

			$('#nextExample').click(function () {
				updateExample(exampleIndex + 1);
			});
			$('#prevExample').click(function () {
				updateExample(exampleIndex - 1);
			});

			setSelectedControl("citation");

			if (advancedMode()) {
				$('#alternateSearch').click(function () {
					oldCitation = "";
					oldBibliography = "";
					formChanged();
				});

				$('#includeReference').click(function () {
					if ($(this).is(':checked')) {
						referencesToSearch[exampleIndex] = true;
					} else {
						referencesToSearch[exampleIndex] = false;
					}
				});

				$('#advancedControls').css('display', 'inline');
			}
		};
	};

	return CSLEDIT_SearchByExample;
});
