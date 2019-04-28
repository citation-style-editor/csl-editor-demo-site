"use strict";

// Custom property panel for 'choose/if' and 'choose/else-if' nodes

define(['src/CslNode', 'src/debug'], function (CSLEDIT_CslNode, debug) {

	// Creates a conditional propery panel in the given element
	var CSLEDIT_ConditionalPropertyPanel = function (element, node, executeCommand) {
		var that = this;

		this.element = element;
		this.node = new CSLEDIT_CslNode(node);
		this.node.children = []; // not interested in the children
		this.executeCommand = executeCommand;

		this.conditions = []; // the 'model' for this view

		// any / none / all selector
		this.matchSelect = $('<select/>');
		$.each(CSLEDIT_schema.attributes('choose/if').match.values, function (i, value) {
			that.matchSelect.append($('<option>').text(value.value));
		});

		// generate mainOptions from the schema
		this.mainOptions = {};
		$.each(this._attributeUI, function (attribute, ui) {
			var mainOptionProperties = that.mainOptions[ui.mainOption] || [];
			
			mainOptionProperties.push({
				attribute: attribute,
				subOption: ui.subOption
			});
			that.mainOptions[ui.mainOption] = mainOptionProperties;
		});

		this._setup();
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._attributeValue = function (attribute) {
		var that = this,
			values = [];

		$.each(that.conditions, function (i, condition) {
			if (condition.attribute === attribute) {
				values.push(condition.value);
			}
		});

		return values.join(" ");
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._removeDuplicateOptions = function () {
		var that = this;

		$.each(that.node.attributes, function (attrIndex, attribute) {
			var selectedValues = that._attributeValue(attribute.key).split(" "),
				processedValues = [],
				availableValues;

			if (attribute.key !== "match") {
				// remove currently selcted values from availableValues
				availableValues = that._possibleValues(attribute.key);
				$.each(selectedValues, function (i, value) {
					var index = availableValues.indexOf(value);
					if (index !== -1) {
						availableValues.splice(index, 1);
					}
				});

				// remove duplicate values
				$.each(that.valueControls, function (i, valueControl) {
					if (that.conditions[i].attribute === attribute.key) {
						var $this = $(this),
							value = $this.val();

						// check if it's a duplicate
						if (processedValues.indexOf(value) !== -1) {
							if (availableValues.length === 0) {
								// no more available values, set processedValues and setup again
								that.node.setAttr(attribute.key, processedValues.join(" "));
								that.executeCommand('amendNode', [that.node.cslId, that.node]);
								that._setup();
								return;
							} else {
								// give it a new value
								value = availableValues.pop();
								$this.val(value);
								selectedValues.push(value);
							}
						}
						processedValues.push(value);
					}
				});

				// remove currently selected values from other controls options
				$.each(that.valueControls, function (i, valueControl) {
					if (that.conditions[i].attribute === attribute.key) {
						var $this = $(this);

						// remove all except current val
						$this.find('option[value!="' + $this.val() + '"]').remove();

						// add back the other available options
						$.each(availableValues, function (i, option) {
							$this.append($('<option/>').text(option));
						});
					}
				});
			}
		});
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._attributeUI = {
		"type" : {
			mainOption: "The document type is"
		},
		"disambiguate" : {
			mainOption: "Citations are disambiguated"
		},
		"variable" : {
			mainOption: "The variable",
			subOption: "is present"
		},
		"is-numeric" : {
			mainOption: "The variable",
			subOption: "is a number"
		},
		"is-uncertain-date" : {
			mainOption: "The date",
			subOption: "is uncertain"
		},
		"locator" : {
			mainOption: "The locator subtype",
			subOption: "is present"
		},
		"position" : {
			mainOption: "The position is"
		}	
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._possibleValues = function (attribute) {
		// get possible values from schema
		var possibleValues = [];
		$.each(CSLEDIT_schema.choices("choose/if"), function (i, choice) {
			if (choice.attributes.hasOwnProperty(attribute)) {
				$.each(choice.attributes[attribute].values, function (i2, possibleValue) {
					if (possibleValue.type === "value") {
						possibleValues.push(possibleValue.value);
					}
				});
				return false;
			}
		});

		// for MLZ schema which doesn't put the values in choices
		if (possibleValues.length === 0 && attribute in CSLEDIT_schema.attributes("choose/if")) {
			$.each(CSLEDIT_schema.attributes("choose/if")[attribute].values, function (i, possibleValue) {
				if (possibleValue.type === "value") {
					possibleValues.push(possibleValue.value);
				}
			});
		}

		return possibleValues;
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._availableValues = function (attribute) {
		var availableValues = this._possibleValues(attribute),
			selectedValues = this._attributeValue();

		// remove currently selcted values from availableValues
		$.each(this._attributeValue(attribute).split(" "), function (i, value) {
			var index = availableValues.indexOf(value);
			if (index !== -1) {
				availableValues.splice(index, 1);
			}
		});
		return availableValues;
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._createConditionControls = function (i, condition) {
		var that = this,
			mainOption,
			mainOptionControl,
			valueControl,
			subOptionControl;

		// create mainOption
		mainOptionControl = $('<select class="mainOptionSelect" />').attr('data-index', i);
		$.each(that.mainOptions, function (mainOption, properties) {
			mainOptionControl.append($('<option/>').text(mainOption));
		});
		mainOption = that._attributeUI[condition.attribute].mainOption;
		mainOptionControl.val(mainOption);
		that.mainOptionControls[i] = mainOptionControl;

		// create subOptionControl
		if (that.mainOptions[mainOption].length > 1) {
			subOptionControl = $('<select class="subOptionSelect" />').attr('data-index', i);
			$.each(that.mainOptions[mainOption], function (i, properties) {
				subOptionControl.append($('<option/>').text(properties.subOption));
				if (condition.attribute === properties.attribute) {
					subOptionControl.val(properties.subOption);
				}
			});
		} else {
			subOptionControl = $('<span/>');
			$.each(that.mainOptions[mainOption], function (i, properties) {
				subOptionControl.append(properties.subOption);
			});
		}
		that.subOptionControls[i] = subOptionControl;
		
		// create value control
		if (that._possibleValues(condition.attribute).length > 1) {
			valueControl = $('<select class="valueSelect" />').attr('data-index', i);
		
			$.each(that._possibleValues(condition.attribute), function (i, possibleValue) {
				valueControl.append($('<option/>').text(possibleValue));
			});
			valueControl.val(condition.value);
		} else {
			valueControl = $(); // empty
		}

		that.valueControls[i] = valueControl;
	};

	// for adding or amending
	CSLEDIT_ConditionalPropertyPanel.prototype._setCondition = function (index, newCondition) {
		var that = this,
			oldCondition = that.conditions[index],
			value;

		// set condition
		that.conditions[index] = newCondition;	

		// update view
		that._createConditionControls(index, newCondition);
		that._refresh();

		if (typeof(oldCondition) !== "undefined") {
			// update old attribute value
			value = that._attributeValue(oldCondition.attribute);
			if (value === "") {
				that.node.setAttrEnabled(oldCondition.attribute, false);
			} else {
				that.node.setAttr(oldCondition.attribute, value);
			}
		}

		// update new attribute value
		that.node.setAttr(newCondition.attribute, that._attributeValue(newCondition.attribute));
		that.executeCommand('amendNode', [that.node.cslId, that.node]);
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._removeCondition = function (index) {
		var that = this,
			attribute = that.conditions[index].attribute,
			i;

		// update conditions
		that.conditions.splice(index, 1);

		// update view
		that.mainOptionControls.length = that.conditions.length;
		that.subOptionControls.length = that.conditions.length;
		that.valueControls.length = that.conditions.length;

		for (i = index; i < that.conditions.length; i++) {
			that._createConditionControls(i, that.conditions[i]);
		}

		that._refresh();

		// update value
		if (that._attributeValue(attribute) === "") {
			that.node.setAttrEnabled(attribute, false);
		} else {
			that.node.setAttr(attribute, that._attributeValue(attribute));
		}
		that.executeCommand('amendNode', [that.node.cslId, that.node]);
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._setupEventHandlers = function () {
		var that = this;

		// event handlers
		this.element.find('select.mainOptionSelect').on('change', function () {
			var $this = $(this),
				index = $this.attr('data-index'),
				optionProperties = that.mainOptions[$this.val()][0],
				attribute = optionProperties.attribute,
				newCondition = {};

			newCondition.attribute = attribute;
			newCondition.value = that._availableValues(attribute)[0];
			if (typeof(newCondition.value) === "undefined") {
				alert("No more available values for this condition type");
				return;
			}
			that._setCondition(index, newCondition);
		});

		this.element.find('select.subOptionSelect').on('change', function () {
			var $this = $(this),
				index = $this.attr('data-index'),
				subOption = $this.val(),
				optionProperties = that.mainOptions[
					that.element.find('select.mainOptionSelect').eq(index).val()],
				attribute,
				newCondition = {},
				oldValue = that.conditions[index].value;

			$.each(optionProperties, function (i, properties) {
				if (properties.subOption === subOption) {
					attribute = properties.attribute;
					return false;
				}
			});

			debug.assert(typeof(attribute) !== "undefined");

			newCondition.attribute = attribute;

			if (that._availableValues(attribute).indexOf(oldValue) !== -1) {
				newCondition.value = oldValue;
			} else {
				newCondition.value = that._availableValues(attribute)[0];
			}

			if (typeof(newCondition.value) === "undefined") {
				alert("No more available values for this condition type");
				return;
			}
			that._setCondition(index, newCondition);
		});

		this.element.find('select.valueSelect').on('change', function () {
			var $this = $(this),
				index = $this.attr('data-index'),
				newCondition = {};

			newCondition.attribute = that.conditions[index].attribute;
			newCondition.value = $this.val();

			that._setCondition(index, newCondition);
		});

		this.element.find('button.addValue').on('click', function () {
			var newCondition = {};

			$.each(that._attributeUI, function (attribute) {
				var values = that._availableValues(attribute);

				if (values.length > 0) {
					newCondition.attribute = attribute;
					newCondition.value = values[0];
					return false;
				}
			});

			if (!newCondition.hasOwnProperty("attribute")) {
				alert("No more available conditions");
				return;
			}

			that._setCondition(that.conditions.length, newCondition);
		});

		this.element.find('button.deleteValue').on('click', function (event) {
			var index = that.element.find('button.deleteValue').index(event.target);

			that._removeCondition(index);
		});
		
		this.matchSelect.on('change', function () {
			// update data
			that.node.setAttr('match', that.matchSelect.val());
			that.executeCommand('amendNode', [that.node.cslId, that.node]);

			// update view
			that._refresh();
		});
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._setup = function () {
		var that = this;

		this.conditions = [];

		$.each(this.node.attributes, function (i, attribute) {
			if (attribute.key !== "match" && attribute.enabled) {
				$.each(attribute.value.split(" "), function (i, value) {
					that.conditions.push({
						attribute : attribute.key,
						value : value
					});
				});
			}
		});
		
		// set matchSelect value
		this.matchSelect.val(this.node.getAttr('match') || 
				CSLEDIT_schema.attributes("choose/if").match.defaultValue);

		if (this.conditions.length === 0) {
			// should show at least one attribute value, so create one
			// NOTE: this is slightly strange behaviour for a view
			//       but should never happen - only after loading an
			//       invalid style

			this.node.setAttr("type", "article");
			this.node.setAttr("match", "any");
			that.executeCommand('amendNode', [this.node.cslId, this.node]);
			this._setup();
			return;
		}

		this.mainOptionControls = [];
		this.valueControls = [];
		this.subOptionControls = [];
		$.each(that.conditions, function (i, condition) {
			that._createConditionControls(i, condition);
		});

		this._refresh();
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._refresh = function () {
		this._drawControls();
		this._removeDuplicateOptions();
		this._setupEventHandlers();
	};

	CSLEDIT_ConditionalPropertyPanel.prototype._drawControls = function () {
		var that = this,
			table = $('<table class="conditional"><col class="c1" /><col class="c2" />' + 
					'<col class="c3" /><col class="c4" /><col class="c5" /></table>'),
			valueSeparator,
			matchValue = this.node.getAttr('match') ||
				CSLEDIT_schema.attributes("choose/if").match.defaultValue;
		
		this.element.children().remove();

		this.element.append($('<p/>').text(this.node.name)
			.append(' ')
			.append(this.matchSelect)
			.append(' of the following conditions are met'));

		if (matchValue === "all") {
			valueSeparator = '<span class="weak">and</span>';
		} else {
			valueSeparator = '<span class="weak">or</span>';
		}

		$.each(this.valueControls, function (i, valueControl) {
			var row = $('<tr/>');

			row.append($('<td class="mainOption" />').append(that.mainOptionControls[i]));
			row.append($('<td/>').append(valueControl));

			row.append($('<td/>').append(that.subOptionControls[i]));
			if (i === that.valueControls.length - 1) {
				row.append($('<td/>'));
			} else {
				row.append($('<td/>').html(valueSeparator));
			}

			row.append('<td class="delete"><button class="deleteValue">-</button></td>');
			if (that.valueControls.length === 1) {
				row.find('button.deleteValue').css({visibility: "hidden"});
			}

			if (i === that.valueControls.length - 1) {
				row.append('<td class="add"><button class="addValue">+</button></td>');
			} else {
				row.append('<td class="add" />');
			}

			table.append(row);
		});
		
		this.element.append(table);
	};
	return CSLEDIT_ConditionalPropertyPanel;
});
