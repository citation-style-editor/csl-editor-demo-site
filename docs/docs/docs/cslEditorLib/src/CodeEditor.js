"use strict";

// This creates a CSL code editor with real time preview
//
// It uses CodeMirror to provide the code editing view

define([	'src/citationEngine',
			'src/options',
			'src/dataInstance',
			'src/urlUtils',
			'external/codemirror',
			'external/codemirrorXmlMode',
			'jquery.layout'
		],
		function (
			CSLEDIT_citationEngine,
			CSLEDIT_options,
			CSLEDIT_data,
			CSLEDIT_urlUtils,
			CodeMirror,
			CodeMirrorXmlMode,
			jquery_layout
		) {
	// Creates a CSL Code Editor within containerElement
	var CSLEDIT_codeEditor = function (
			containerElement,     // the selector or jQuery element to create the editor within
			configurationOptions  // see https://github.com/citation-style-editor/csl-editor/wiki/Code-Editor
			                      // for available options
			) {
		var codeTimeout,
			editor,
			diffTimeout,
			diffMatchPatch = new diff_match_patch(),
			oldFormattedCitation = "",
			newFormattedCitation = "",
			oldFormattedBibliography = "",
			newFormattedBibliography = "",
			styleURL;

		containerElement = $(containerElement);

		CSLEDIT_options.setOptions(configurationOptions);

		$.ajax({
			url: CSLEDIT_urlUtils.getResourceUrl("html/codeEditor.html"),
			success : function (data) {
				containerElement.html(data);
				init();
			},
			error : function (jaXHR, textStatus, errorThrown) {
				alert("Couldn't fetch page: " + textStatus);
			},
			cache : false,
			dataType : "text"
		});

		var init = function () {
			var codeMirrorScroll,
				codeMirrorContainer,
				userCallback = CSLEDIT_options.get("onChange");

			CodeMirror.defaults.onChange = function()
			{
				clearTimeout(codeTimeout);
				codeTimeout = setTimeout( function () {
					var result = CSLEDIT_data.setCslCode(editor.getValue());

					if ("error" in result) {
						$("#statusMessage").text(result.error);
						$("#formattedCitations").html("");
						$("#formattedBibliography").html("");
					} else {
						CSLEDIT_citationEngine.runCiteprocAndDisplayOutput(
							CSLEDIT_data,
							$("#statusMessage"),
							$("#formattedCitations"), $("#formattedBibliography"));
					}

					if (typeof(userCallback) !== "undefined") {
						userCallback(editor.getValue());
					}
				}, 500);
			};

			editor = CodeMirror.fromTextArea($("#code")[0], {
					mode: { name: "xml" },
					lineNumbers: true
			});

			CSLEDIT_data.initPageStyle( function () {
				editor.setValue(CSLEDIT_data.getCslCode());
			});

			codeMirrorScroll = $('.CodeMirror-scroll');
			codeMirrorContainer = $('#codeMirrorContainer');
			
			var resizeCodeEditor = function () {
				
				codeMirrorScroll.css({
					height: codeMirrorContainer.height() + "px"
				});
			};

			containerElement.layout({
				north__size : 300,
				livePaneResizing : true,
				onresize : resizeCodeEditor
			});

			resizeCodeEditor();
		}
	};

	return CSLEDIT_codeEditor;
});
