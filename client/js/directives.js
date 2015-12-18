(function(ng, app){
	
	"use strict";

	app.directive("bpNav", function(DEFAULTS){
		return{
			restrict: 'E',
			templateUrl: DEFAULTS.DIR + 'bpnav.htm'
		};
	})

	.directive('addBp', function(DEFAULTS, settings){
		return{
			restrict: 'E',
			templateUrl: DEFAULTS.DIR + 'addbp.htm',
			controllerAs: 'ctrl',
			controller: function($scope, bprecords){
				this.bpr = {};

				this.submitBpr = function(bpr){
					bprecords.save(this.bpr).then(function(response) {
						//update list
						$scope.records.unshift(response.data);
						$scope.records = $scope.records.splice(0, settings.rowsPerPage); 
						$scope.bpForm.$setPristine();
					});
					this.bpr = {};
				};
			}
		};
	})

	.directive('bpRecords', function(DEFAULTS){
		return{
			restrict: 'E',
			templateUrl: DEFAULTS.DIR + 'bprecords.htm',
			controller: function($scope, $window, $attrs, modal, bprecords, settings, pager, utils){
				var currentEdit = null,
					cancelRow,
					loadRows;

				$scope.editRowNo = -1;
				$scope.limits = settings.limits;
				$scope.pageTpe = $attrs.tpe;

				cancelRow = function(rowNo){
					if (currentEdit && currentEdit.no !== rowNo){
						//Previous edit not submitted, cancel
						$scope.cancelEdit(currentEdit.no);
					}
				};
				loadRows = function(month){
					bprecords.retrieve('all', month).then(function(response){
						$scope.records = response.data.records;
						$scope.totalNoOfRecords = response.data.total;
					});
				};

				$scope.editRow = function(rowNo){
					var dt = new Date($scope.records[rowNo].dt);
					cancelRow(rowNo);
					currentEdit = {
						"data":angular.copy($scope.records[rowNo]), 
						"no": rowNo
					};

					$scope.dateEdit = {
						date: utils.getDate(dt), 
						time: utils.getTime(dt)
					};

					$scope.editRowNo = rowNo;
				};
				$scope.deleteRow = function(rowNo){
					cancelRow(rowNo);

					modal.showModal({}, {}, null).then(function (result) {
						bprecords.delete($scope.records[rowNo]);
						$scope.records.splice(rowNo, 1);
						$scope.editRowNo = -1;
					});
				};
				$scope.submitEdit = function(rowNo){
					var dt = new Date($scope.dateEdit.date),
						dtOriginal = new Date(currentEdit.data.dt),
						originalTime = utils.getTime(dtOriginal),
						dtupdated = false;

					//Check if row data is valid
					if ($scope.bpTableForm["date" + rowNo].$invalid || 
						$scope.bpTableForm["time" + rowNo].$invalid || 
						$scope.bpTableForm["sys" + rowNo].$invalid || 
						$scope.bpTableForm["dia" + rowNo].$invalid || 
						$scope.bpTableForm["pulse" + rowNo].$invalid
					){
						return;
					}

					//Check if date or time was modified
					if (currentEdit.data.dt !== dt.toISOString() || originalTime !== $scope.dateEdit.time){
						var time = $scope.dateEdit.time.split(":");
						dt.setHours(time[0]);
						dt.setMinutes(time[1]);
						$scope.records[rowNo].dt = dt.toISOString();
						dtupdated = true;
					}

					bprecords.update($scope.records[rowNo]);
					$scope.editRowNo = -1;

					if (dtupdated){
						bprecords.retrieve('all', $scope.pager.currentPage).then(function(response){
							$scope.records = response.data.records;
						});
					}
				};
				$scope.cancelEdit = function(rowNo){
					if (currentEdit){
						$scope.records[rowNo] = currentEdit.data;
						$scope.editRowNo = -1;
						currentEdit = null;
					}
				};
				$scope.editNote = function(rowNo){
					var modalDefaults = {templateUrl: '/partials/modals/note.htm'},
						modalOptions = {headerText: 'Note'},
						data = {
							"note": $scope.records[rowNo].note, 
							"noteOnChart": $scope.records[rowNo].noteOnChart};

					modal.showModal(modalDefaults, modalOptions, angular.copy(data)).then(function (newData) {
						if (!angular.equals(data, newData)){
							newData._id = $scope.records[rowNo]._id;
							bprecords.updateNote(newData).then(function(response){
								$scope.records[rowNo].note = newData.note;
								$scope.records[rowNo].noteOnChart = newData.noteOnChart;
							});
						}
					});
				};
				$scope.onKeyPressed = function(event){
					if (event.which === 13){ //Enter
						$scope.submitEdit($scope.editRowNo);
					}
				};
				$window.onkeydown = function(event) {
					if (event.which === 27){ //ESC
						$scope.cancelEdit($scope.editRowNo);
						$scope.$apply();
					}
				};
				$scope.$on("month:updated", function(event, month){
					loadRows(month);
				});

				loadRows(pager.getCurrentMonth());
			}
	    };
	})

	.directive("bpPager", function(DEFAULTS){
		return{
			restrict: 'E',
			templateUrl: DEFAULTS.DIR + 'bppager.htm',
			controller: function($scope, bprecords, pager){
				var firstYear,
					curYear;
				$scope.pager = pager.getCurrentMonth();
				$scope.months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
				
				
				bprecords.getOldestDay().then(function(response){
					var dt = new Date(response.data),
						years = [];

					firstYear = dt.getFullYear();
					curYear = new Date().getFullYear();

					for (var y = firstYear; y <= curYear; y++){
						years.push(y);
					}
					$scope.years = years;
				});

				$scope.changeMonth = function(month){
					$scope.pager.month = month;
					$scope.$emit("month:updated", $scope.pager);
				};

				$scope.changeYear = function(year){
					$scope.pager.year = year;
					$scope.$emit("month:updated", $scope.pager);
				};

				$scope.nextMonth = function(dir){
					var  m = $scope.pager.month + dir;
					m = m < 0 ? DEFAULTS.MONTHS - 1 : m;
					$scope.pager.month = m % DEFAULTS.MONTHS;
					$scope.$emit("month:updated", $scope.pager);
				};

				$scope.nextYear = function(dir){
					var  y = $scope.pager.year + dir;
					y = y < firstYear ? curYear : y;
					$scope.pager.year = y > curYear ? firstYear : y;
					$scope.$emit("month:updated", $scope.pager);
				};
			}
		};
	})

	.directive("datetimePicker", function(DEFAULTS){
		return{
			restrict:'E',
			templateUrl: DEFAULTS.DIR + 'datetimepicker.htm',
			controller: 
			function ($scope) {
				
				$scope.today = function() {
					$scope.dt = new Date();
				};

				$scope.clear = function () {
					$scope.dt = null;
				};
				$scope.clear();

				$scope.maxDate = new Date();

				$scope.open = function($event) {
					$scope.status.opened = true;
				};

				$scope.dateOptions = {
					formatYear: 'yy',
					startingDay: 1
				};

				$scope.formats = ['dd/MM/yy'];
				$scope.format = $scope.formats[0];

				$scope.status = {
					opened: false
				};
			}
		};
	});
})(angular, kmBpr);

